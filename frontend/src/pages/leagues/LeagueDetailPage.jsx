import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import PageTitle from '../../components/PageTitle'
import { ErrorMessage, EmptyState, Loading } from '../../components/Status'
import { getLeague, getLeagueScorers, getLeagueStandings, getLeagueWinner, getLeagueWinImpact } from '../../services/leagueApi'
import { getLeagueTeams } from '../../services/teamApi'
import { getLeagueAttendance, getLeagueAttendanceRates, getLeagueAttendanceSummary, getLeagueGames, getPlayerScores } from '../../services/gameApi'
import StandingsList from '../../components/StandingsList'
import LeagueStatusBadge from '../../components/LeagueStatusBadge'
import WinImpactList from '../../components/WinImpactList'
import '../../styles/game-list.css'
import '../../styles/winner.css'
import '../../styles/standings.css'
import '../../styles/win-impact.css'

const activeTabs = [['standings', '팀 순위'], ['games', '경기'], ['scorers', '개인 득점'], ['win-impact', '승리기여도'], ['participants', '팀/참가자']]
const completedTabs = [['winner', '우승팀'], ['standings', '최종 순위'], ['games', '경기 결과'], ['scorers', '개인 득점'], ['win-impact', '승리기여도'], ['participants', '팀/참가자']]
const allTabs = [...new Set([...activeTabs, ...completedTabs].map(([key]) => key))]
const formatDate = value => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }) : '날짜 미정'
const isWinner = (game, teamId) => {
  if (game.status !== 'COMPLETED' || game.homeScore == null || game.awayScore == null) return false
  const homeScore = Number(game.homeScore)
  const awayScore = Number(game.awayScore)
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore) || homeScore === awayScore) return false
  return homeScore > awayScore ? Number(teamId) === Number(game.homeTeam.id) : Number(teamId) === Number(game.awayTeam.id)
}
const gameDateKey = game => String(game.gameDate || '').slice(0, 10)
const attendanceTeamOrder = ['블랙', '화이트', '컬러']
const attendanceNameCollator = new Intl.Collator('ko-KR')
const participantNameCollator = new Intl.Collator('ko-KR')

function groupGamesByDate(games) {
  const groups = new Map()
  games.forEach(game => {
    const date = gameDateKey(game)
    if (!groups.has(date)) groups.set(date, [])
    groups.get(date).push(game)
  })
  return [...groups.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([date, dateGames]) => ({ date, games: dateGames.sort((left, right) => Number(left.gameNo) - Number(right.gameNo) || Number(left.gameId) - Number(right.gameId)) }))
}

function dateStatus(games) {
  if (games.every(game => game.status === 'COMPLETED')) return '종료'
  if (games.every(game => game.status !== 'COMPLETED')) return '예정'
  return '진행 중'
}

function groupAttendeesByTeam(attendees) {
  const groups = new Map()
  attendees.forEach(attendee => {
    const teamName = attendee.teamName || '기타'
    if (!groups.has(teamName)) groups.set(teamName, { teamName, members: [], guests: [] })
    groups.get(teamName)[attendee.type === 'GUEST' ? 'guests' : 'members'].push(attendee)
  })
  const sortByName = (left, right) => attendanceNameCollator.compare(left.name, right.name) || Number(left.id) - Number(right.id)
  return [...groups.values()]
    .map(group => ({ ...group, members: group.members.sort(sortByName), guests: group.guests.sort(sortByName) }))
    .sort((left, right) => {
      const leftOrder = attendanceTeamOrder.indexOf(left.teamName)
      const rightOrder = attendanceTeamOrder.indexOf(right.teamName)
      if (leftOrder !== -1 || rightOrder !== -1) return (leftOrder === -1 ? attendanceTeamOrder.length : leftOrder) - (rightOrder === -1 ? attendanceTeamOrder.length : rightOrder)
      if (left.teamName === '기타') return 1
      if (right.teamName === '기타') return -1
      return attendanceNameCollator.compare(left.teamName, right.teamName)
    })
}

function AttendanceSection({ summary, detail, expanded, onToggle }) {
  if (!summary?.isRegistered) return <div className="game-day-attendance"><div className="attendance-summary"><span className="attendance-empty">출석 미등록</span></div></div>
  return <div className="game-day-attendance">
    <div className="attendance-summary">
      <span><b>참석 {summary.totalCount}명</b><i>·</i><span>정회원 {summary.memberCount}</span><i>·</i><span className="attendance-guest">게스트 {summary.guestCount}</span></span>
      <button type="button" onClick={onToggle} aria-expanded={expanded}>참석자 {expanded ? '접기' : '보기'} <span aria-hidden="true">{expanded ? '▲' : '›'}</span></button>
    </div>
    {expanded && (detail === undefined
      ? <p className="attendance-loading">참석자를 불러오는 중...</p>
      : detail === null
        ? <p className="attendance-error">참석자 정보를 불러오지 못했습니다.</p>
        : <div className="attendance-details">
          {groupAttendeesByTeam(detail.attendees).map(group => <div className="attendance-team-row" key={group.teamName}>
            <b className="attendance-team-name">{group.teamName}</b>
            <div className="attendance-team-members">
              {group.members.map(attendee => <span className="attendance-member" key={`member-${attendee.id}`}>{attendee.name}</span>)}
              {group.members.length > 0 && group.guests.length > 0 && <i className="attendance-member-divider" aria-hidden="true">/</i>}
              {group.guests.map(attendee => <span className="attendance-member attendance-guest" key={`guest-${attendee.id}`}>{attendee.name}</span>)}
            </div>
          </div>)}
          {detail.totalCount === 0 && <p className="attendance-none">참석자가 없습니다.</p>}
        </div>)}
  </div>
}

function ScorersList({ scorers }) {
  if (scorers.every(player => player.totalPoints === 0 && player.gamesScored === 0)) return <EmptyState text="아직 개인 득점 기록이 없습니다." />
  const leaders = scorers.filter(player => player.rank === 1)
  return <div className="scorer-list">{leaders.length > 0 && <section className="scorer-winner card"><small>{leaders.length > 1 ? '공동 득점 1위' : '득점 1위'}</small>{leaders.map(player => <div key={player.leagueMemberId}><h3>{player.memberName}</h3><b>{player.totalPoints}점</b></div>)}</section>}{scorers.map(player => <article className="scorer-card card" key={player.leagueMemberId}><b className="rank-number">{player.rank}위</b><div><strong>{player.memberName}</strong><span>{player.teamName || '미배정'} · 기록 경기 {player.gamesScored}회</span></div><div><strong>{player.totalPoints}점</strong><span>평균 {Number(player.averagePoints).toFixed(1)}점</span></div></article>)}</div>
}

function WinnerCard({ winner }) {
  if (!winner) return <section className="winner-empty card"><span aria-hidden="true">🏆</span><h2>우승팀</h2><p>아직 우승팀이 확정되지 않았습니다.</p></section>
  return <section className="winner-card card"><small>🏆 우승팀</small><h2>{winner.teamName}</h2><h3>우승 멤버</h3>{winner.members.length ? <div className="winner-members">{winner.members.map(member=><span key={member.memberId}>{member.name}</span>)}</div> : <p className="muted">배정된 우승 멤버가 없습니다.</p>}</section>
}

function LeagueHeader({ league }) {
  return <div className="league-detail-head">
    <PageTitle eyebrow="LEAGUE DETAIL" title={league.name} back />
    <div className="league-summary card"><span>{league.year}년 {league.quarter}분기</span><i aria-hidden="true">·</i><LeagueStatusBadge status={league.status} /></div>
  </div>
}

function LeagueTabs({ tabs, selectedTab, onSelect }) {
  return <div className={`tabs tab-count-${tabs.length}`} role="tablist" aria-label="리그 상세 메뉴">
    {tabs.map(([key, label]) => <button type="button" role="tab" aria-selected={selectedTab === key} className={selectedTab === key ? 'selected' : ''} key={key} onClick={() => onSelect(key)}>{label}</button>)}
  </div>
}

const formatAttendanceRate = rate => `${Number(rate).toFixed(Number(rate) % 1 ? 1 : 0)}%`

function sortParticipants(participants, sort, captainMemberId = null) {
  return [...participants].sort((left, right) => {
    const leftIsCaptain = captainMemberId !== null && Number(left.leagueMemberId) === Number(captainMemberId)
    const rightIsCaptain = captainMemberId !== null && Number(right.leagueMemberId) === Number(captainMemberId)
    if (leftIsCaptain !== rightIsCaptain) return leftIsCaptain ? -1 : 1
    if (sort === 'name') return participantNameCollator.compare(left.name, right.name) || Number(left.memberId) - Number(right.memberId)
    return Number(right.attendanceRate) - Number(left.attendanceRate)
      || Number(right.attendanceCount) - Number(left.attendanceCount)
      || participantNameCollator.compare(left.name, right.name)
      || Number(left.memberId) - Number(right.memberId)
  })
}

function ParticipantAttendanceRow({ participant, isCaptain }) {
  const isGuest = participant.memberType === 'GUEST'
  return <article className="participant-attendance-row">
    <div><b className={isCaptain ? 'captain-name' : isGuest ? 'attendance-guest' : ''}>{isCaptain ? '👑 ' : ''}{participant.name}{isCaptain ? ' · 주장' : ''}</b><span>{participant.teamName || '미배정'} · <em className={isGuest ? 'attendance-guest' : ''}>{isGuest ? '게스트' : '정회원'}</em></span></div>
    <div><strong>{formatAttendanceRate(participant.attendanceRate)}</strong><small>{participant.attendanceCount} / {participant.totalAttendanceDays}</small></div>
  </article>
}

export default function LeagueDetailPage() {
  const [winImpact, setWinImpact] = useState(null)
  const { id } = useParams(); const [searchParams, setSearchParams] = useSearchParams(); const requestedTab = searchParams.get('tab'); const [league, setLeague] = useState(null); const [standings, setStandings] = useState(null); const [scorers, setScorers] = useState(null); const [winner, setWinner] = useState(undefined); const [participants, setParticipants] = useState(null); const [teams, setTeams] = useState([]); const [games, setGames] = useState(null); const [attendanceSummary, setAttendanceSummary] = useState({}); const [attendanceDetails, setAttendanceDetails] = useState({}); const [expandedAttendance, setExpandedAttendance] = useState(null); const [scores, setScores] = useState({}); const [participantSort, setParticipantSort] = useState('rate'); const [tab, setTab] = useState(allTabs.includes(requestedTab) ? requestedTab : null); const [error, setError] = useState('')
  useEffect(() => { getLeague(id).then(data => { const availableTabs = data.status === 'COMPLETED' ? completedTabs : activeTabs; const defaultTab = data.status === 'COMPLETED' ? 'winner' : 'standings'; setLeague(data); setTab(current => availableTabs.some(([key]) => key === current) ? current : defaultTab) }).catch(() => setError('정보를 불러오지 못했습니다.')) }, [id])
  useEffect(() => {
    if (tab === 'standings') getLeagueStandings(id).then(data => setStandings(data.standings)).catch(() => setError('순위 정보를 불러오지 못했습니다.'))
    if (tab === 'scorers') getLeagueScorers(id).then(data => setScorers(data.scorers)).catch(() => setError('개인 득점 순위를 불러오지 못했습니다.'))
    if (tab === 'winner') getLeagueWinner(id).then(data => setWinner(data.winner)).catch(() => setError('우승팀 정보를 불러오지 못했습니다.'))
    if (tab === 'win-impact') getLeagueWinImpact(id).then(setWinImpact).catch(() => setError('승리기여도 정보를 불러오지 못했습니다.'))
    if (tab === 'participants') Promise.all([getLeagueAttendanceRates(id), getLeagueTeams(id)])
      .then(([attendanceData, teamData]) => { setParticipants(attendanceData.participants); setTeams(teamData) })
      .catch(() => setError('참가자 정보를 불러오지 못했습니다.'))
    if (tab === 'games') Promise.all([getLeagueGames(id), getLeagueAttendanceSummary(id)])
      .then(([gameData, summaryData]) => { setGames(gameData); setAttendanceSummary(Object.fromEntries(summaryData.dates.map(item => [item.date, item]))) })
      .catch(() => setError('경기 정보를 불러오지 못했습니다.'))
  }, [id, tab])
  const grouped = teams.map(t => ({ ...t, members: sortParticipants(participants?.filter(p => Number(p.teamId) === Number(t.id)) || [], participantSort, t.captainMemberId) })); const unassigned = sortParticipants(participants?.filter(p => p.teamId == null) || [], participantSort)
  const showScores = gameId => { if (scores[gameId] !== undefined) return; getPlayerScores(gameId).then(data => setScores(s => ({ ...s, [gameId]: data }))).catch(() => setScores(s => ({ ...s, [gameId]: null }))) }
  const toggleAttendance = date => { const cacheKey = `${id}:${date}`; if (expandedAttendance === cacheKey) { setExpandedAttendance(null); return } setExpandedAttendance(cacheKey); if (attendanceDetails[cacheKey] !== undefined) return; getLeagueAttendance(id, date).then(data => setAttendanceDetails(current => ({ ...current, [cacheKey]: data }))).catch(() => setAttendanceDetails(current => ({ ...current, [cacheKey]: null }))) }
  if (error) return <><PageTitle title="리그 상세" back /><ErrorMessage text={error} /></>; if (!league || !tab) return <><PageTitle title="리그 상세" back /><Loading /></>
  const tabs = league.status === 'COMPLETED' ? completedTabs : activeTabs
  const selectTab = key => { setTab(key); setSearchParams({ tab: key }, { replace: true }) }
  const content = tab === 'win-impact'
    ? winImpact === null ? <Loading /> : <><div className="win-impact-heading"><small>WIN IMPACT</small><h2>승리기여도</h2><p>내가 참가한 경기의 승률이<br />해당 팀의 평균 승률보다 얼마나 높거나 낮은지 보여줍니다. (최소 6경기)</p></div><WinImpactList players={winImpact?.players} /></>
    : tab === 'standings'
    ? standings === null ? <Loading /> : <StandingsList standings={standings} />
    : tab === 'games'
      ? games === null ? <Loading /> : games.length === 0 ? <EmptyState text="등록된 경기가 없습니다." /> : <div className="game-list">{groupGamesByDate(games).map(group => <article className="card game-day-card" key={group.date}>
        <div className="game-day-head"><h3>{formatDate(group.date)}</h3><span className={`game-status ${dateStatus(group.games) === '종료' ? '' : 'scheduled'}`}>{dateStatus(group.games)}</span></div>
        <div className="game-day-rows">{group.games.map(game => {
          const expanded = scores[game.gameId]
          const homeWon = isWinner(game, game.homeTeam.id)
          const awayWon = isWinner(game, game.awayTeam.id)
          return <section className="game-row" key={game.gameId}>
            <div className="game-row-main"><b className="game-number">{game.gameNo}경기</b><div className="game-match">
              <strong className={homeWon ? 'game-winner' : ''} title={game.homeTeam.name}>{game.homeTeam.name}</strong>
              {game.status === 'COMPLETED' ? <b className="game-score"><span className={homeWon ? 'game-winner' : ''}>{game.homeScore}</span><i>:</i><span className={awayWon ? 'game-winner' : ''}>{game.awayScore}</span></b> : <b className="game-vs">VS</b>}
              <strong className={awayWon ? 'game-winner' : ''} title={game.awayTeam.name}>{game.awayTeam.name}</strong>
            </div><span className={`game-row-status ${game.status === 'COMPLETED' ? '' : 'scheduled'}`}>{game.status === 'COMPLETED' ? '종료' : '예정'}</span></div>
            {game.status === 'COMPLETED' && <button type="button" className="score-toggle" aria-expanded={Boolean(expanded)} onClick={() => showScores(game.gameId)}>개인 득점 보기 <span aria-hidden="true">{expanded ? '▲' : '›'}</span></button>}
            {expanded && <div className="score-details">{expanded.teams.map(team => <div className="score-team" key={team.teamId}><h4>{team.teamName}</h4>{team.players.filter(p => p.hasScore).map(p => <p key={p.leagueMemberId}><b>{p.name}</b><span>{p.points}점</span></p>)}{team.players.every(p => !p.hasScore) && <p className="muted">개인 득점 기록이 아직 입력되지 않았습니다.</p>}</div>)}</div>}
          </section>
        })}</div>
        <AttendanceSection summary={attendanceSummary[group.date]} detail={attendanceDetails[`${id}:${group.date}`]} expanded={expandedAttendance === `${id}:${group.date}`} onToggle={() => toggleAttendance(group.date)} />
      </article>)}</div>
      : tab === 'scorers'
        ? scorers === null ? <Loading /> : <ScorersList scorers={scorers} />
        : tab === 'winner'
          ? winner === undefined ? <Loading /> : <WinnerCard winner={winner} />
          : tab === 'participants'
            ? participants === null ? <Loading /> : <><div className="participant-sort"><label htmlFor="participant-sort">참가자 정렬</label><select id="participant-sort" value={participantSort} onChange={event => setParticipantSort(event.target.value)}><option value="rate">참석률순</option><option value="name">이름순</option></select></div><div className="team-groups">{grouped.map(t => <section className="card team-group" key={t.id}><h3>{t.name}</h3>{t.members.map(member => <ParticipantAttendanceRow key={member.leagueMemberId} participant={member} isCaptain={Number(member.leagueMemberId) === Number(t.captainMemberId)} />)}</section>)}{unassigned.length > 0 && <section className="card team-group"><h3>미배정</h3>{unassigned.map(member => <ParticipantAttendanceRow key={member.leagueMemberId} participant={member} />)}</section>}</div></>
            : <div className="empty card"><h3>아직 관련 정보가 없습니다.</h3></div>

  return <><LeagueHeader league={league} /><LeagueTabs tabs={tabs} selectedTab={tab} onSelect={selectTab} />{content}</>
}

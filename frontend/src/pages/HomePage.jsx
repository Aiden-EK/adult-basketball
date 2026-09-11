import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getLeagueStandings, getLeagues, getLeagueWinImpact } from '../services/leagueApi'
import { getLeagueAttendance, getLeagueAttendanceRates, getLeagueGames } from '../services/gameApi'
import { ErrorMessage, Loading } from '../components/Status'
import LeagueStatusBadge from '../components/LeagueStatusBadge'
import StandingsList from '../components/StandingsList'
import { selectCurrentLeague } from '../utils/league'
import { buildAttendanceRanking, formatAttendanceRate } from '../utils/attendanceRanking'
import '../styles/standings.css'
import '../styles/home.css'
import '../styles/win-impact.css'
import { impact } from '../components/WinImpactList'

const gameTime = game => new Date(game.scheduledAt || `${String(game.gameDate).slice(0, 10)}T00:00:00`).getTime()
const compareGames = (left, right) => gameTime(left) - gameTime(right) || Number(left.gameNo) - Number(right.gameNo) || Number(left.gameId) - Number(right.gameId)
const formatDate = game => new Date(game.scheduledAt || `${String(game.gameDate).slice(0, 10)}T00:00:00`).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
const gameDateKey = game => String(game.gameDate || '').slice(0, 10)
const attendanceTeamOrder = ['블랙', '화이트', '컬러']
const attendanceNameCollator = new Intl.Collator('ko-KR')
const isWinner = (game, teamId) => {
  if (game?.status !== 'COMPLETED' || game.homeScore == null || game.awayScore == null) return false
  const homeScore = Number(game.homeScore)
  const awayScore = Number(game.awayScore)
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore) || homeScore === awayScore) return false
  return homeScore > awayScore ? Number(teamId) === Number(game.homeTeam.id) : Number(teamId) === Number(game.awayTeam.id)
}

function FeaturedGame({ label, game, emptyText }) {
  return <article className="home-game card">
    <small>{label}</small>
    {game ? <p className="next-game-date">{formatDate(game)}</p> : <p className="muted">{emptyText}</p>}
  </article>
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

function RecentAttendance({ attendance }) {
  if (attendance === undefined) return null
  if (!attendance?.isRegistered) return <div className="home-recent-attendance"><span className="attendance-empty">출석 미등록</span></div>
  return <section className="home-recent-attendance">
    <div className="home-attendance-summary"><b>참석 {attendance.totalCount}명</b><i>·</i><span>정회원 {attendance.memberCount}</span><i>·</i><span className="attendance-guest">게스트 {attendance.guestCount}</span></div>
    <div className="home-attendance-details">{groupAttendeesByTeam(attendance.attendees).map(group => <div className="home-attendance-team-row" key={group.teamName}>
      <b className="attendance-team-name">{group.teamName}</b>
      <div className="attendance-team-members">
        {group.members.map(attendee => <span className="attendance-member" key={`member-${attendee.id}`}>{attendee.name}</span>)}
        {group.members.length > 0 && group.guests.length > 0 && <i className="attendance-member-divider" aria-hidden="true">/</i>}
        {group.guests.map(attendee => <span className="attendance-member attendance-guest" key={`guest-${attendee.id}`}>{attendee.name}</span>)}
      </div>
    </div>)}</div>
  </section>
}

function RecentGames({ games, attendance }) {
  if (!games.length) return <article className="home-game card"><small>최근 경기</small><p className="muted">완료된 최근 경기가 없습니다.</p></article>
  return <article className="home-game home-recent-games card">
    <div className="home-game-heading"><small>최근 경기</small><span>{formatDate(games[0])}</span></div>
    <div className="home-game-rows">{games.map(game => {
      const homeWon = isWinner(game, game.homeTeam.id)
      const awayWon = isWinner(game, game.awayTeam.id)
      return <div className="home-game-row" key={game.gameId}>
        <b className="home-game-number">{game.gameNo}경기</b>
        <strong className={homeWon ? 'game-winner' : ''} title={game.homeTeam.name}>{game.homeTeam.name}</strong>
        <b className="home-game-score"><span className={homeWon ? 'game-winner' : ''}>{game.homeScore}</span><i>:</i><span className={awayWon ? 'game-winner' : ''}>{game.awayScore}</span></b>
        <strong className={awayWon ? 'game-winner' : ''} title={game.awayTeam.name}>{game.awayTeam.name}</strong>
      </div>
    })}</div><RecentAttendance attendance={attendance} />
  </article>
}

function AttendanceTop({ data, leagueId }) {
  const participants = data?.participants || []
  if (!data || data.totalAttendanceDays === 0) return <div className="empty card home-attendance-top-empty"><p className="muted">아직 출석 기록이 없습니다.</p></div>

  const top = buildAttendanceRanking(participants).slice(0, 9)
  return <div className="attendance-top-grid card">{top.map(participant => <Link className="attendance-top-cell" key={participant.leagueMemberId} to={`/leagues/${leagueId}/attendance-ranking`}>
    <span className="attendance-top-cell-heading"><b>{participant.rank}위</b><strong className={participant.memberType === 'GUEST' ? 'attendance-top-guest' : ''}>{participant.name}</strong><strong className="attendance-top-rate">{formatAttendanceRate(participant.attendanceRate)}</strong></span>
    <small className="attendance-top-cell-attendance">{participant.attendanceCount}/{data.totalAttendanceDays} 참석</small>
  </Link>)}</div>
}

export default function HomePage() {
  const [league, setLeague] = useState(null)
  const [standings, setStandings] = useState(null)
  const [games, setGames] = useState([])
  const [recentAttendance, setRecentAttendance] = useState(undefined)
  const [winImpact, setWinImpact] = useState(null)
  const [attendanceRates, setAttendanceRates] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getLeagues().then(async leagues => {
      const activeLeague = selectCurrentLeague(leagues)
      setLeague(activeLeague)
      if (!activeLeague) return
      const [standingData, gameData, impactData, attendanceData] = await Promise.all([getLeagueStandings(activeLeague.id), getLeagueGames(activeLeague.id), getLeagueWinImpact(activeLeague.id), getLeagueAttendanceRates(activeLeague.id)])
      setStandings(standingData.standings)
      setGames(gameData)
      setWinImpact(impactData)
      setAttendanceRates(attendanceData)
      const completedGames = gameData.filter(game => game.status === 'COMPLETED')
      const latestCompletedDate = completedGames.map(gameDateKey).sort().at(-1)
      if (latestCompletedDate) getLeagueAttendance(activeLeague.id, latestCompletedDate).then(setRecentAttendance).catch(() => setRecentAttendance(null))
    }).catch(() => setError('현재 리그 정보를 불러오지 못했습니다.')).finally(() => setLoading(false))
  }, [])

  const completedGames = games.filter(game => game.status === 'COMPLETED')
  const latestCompletedDate = completedGames.map(gameDateKey).sort().at(-1)
  const recentGames = completedGames.filter(game => gameDateKey(game) === latestCompletedDate).sort((left, right) => Number(left.gameNo) - Number(right.gameNo) || Number(left.gameId) - Number(right.gameId))
  const scheduled = games.filter(game => game.status !== 'COMPLETED').sort(compareGames)[0]

  if (loading) return <Loading />
  if (error) return <ErrorMessage text={error} />
  if (!league) return <section className="home-empty card"><small>CURRENT LEAGUE</small><h1>현재 진행 중인 리그가 없습니다.</h1><p className="muted">지난 리그 기록과 전체 리그 목록은 계속 확인할 수 있습니다.</p><Link className="primary full" to="/leagues">리그 목록 보기</Link></section>

  return <>
    <section className="active-league-head">
      <small>CURRENT LEAGUE</small>
      <div className="active-league-line"><h1>{league.name}</h1><LeagueStatusBadge status={league.status} /></div>
      <p>{league.year}년 {league.quarter}분기</p>
    </section>
    <section className="home-section">
      <div className="section-head"><div><small>STANDINGS</small><h2>현재 리그 순위</h2></div><span className="section-note">경기 결과 자동 반영</span></div>
      {standings === null ? <Loading /> : <StandingsList standings={standings} />}
      <Link className="primary full" to={`/leagues/${league.id}?tab=standings`}>전체 순위 보기</Link>
    </section>
    <section className="home-section">
      <div className="section-head"><div><small>GAMES</small><h2>리그 경기</h2></div><Link className="text-link" to={`/leagues/${league.id}?tab=games`}>전체 보기 →</Link></div>
      <div className="home-games"><RecentGames games={recentGames} attendance={recentAttendance} /><FeaturedGame label="다음 경기" game={scheduled} emptyText="다음 경기가 아직 등록되지 않았습니다." /></div>
    </section>
    <section className="home-section home-win-impact">
      <div className="section-head"><div><small>WIN IMPACT</small><h2>승리기여도 TOP 3</h2></div><Link className="text-link" to={`/leagues/${league.id}?tab=win-impact`}>전체보기 →</Link></div>
      <div className="win-impact-top3 card">{(winImpact?.players || []).filter(player => player.rankingEligible).slice(0, 3).map(player => <Link className="win-impact-top3-row" key={player.leagueMemberId} to={`/leagues/${league.id}?tab=win-impact`}><b>{player.rank}위</b><span><strong>{player.name}</strong><small>{player.games}경기 · {player.wins}승 {player.losses}패</small></span><strong className={player.winImpact > 0 ? 'positive' : player.winImpact < 0 ? 'negative' : ''}>{impact(player.winImpact)}</strong></Link>)}</div>
    </section>
    <section className="home-section home-attendance-top">
      <div className="section-head"><div><small>ATTENDANCE</small><h2>출석왕 TOP 9</h2></div><Link className="text-link" to={`/leagues/${league.id}/attendance-ranking`}>전체보기 →</Link></div>
      <AttendanceTop data={attendanceRates} leagueId={league.id} />
    </section>
    <section className="home-links">
      <Link className="card" to={`/leagues/${league.id}?tab=participants`}><b>팀 · 참가자</b><span>현재 팀 편성 보기 →</span></Link>
      <Link className="card" to="/leagues"><b>지난 리그</b><span>전체 기록 보기 →</span></Link>
      <Link className="card champion-link" to="/champions"><b>🏆 역대 우승팀</b><span>분기별 우승 기록 보기 →</span></Link>
    </section>
  </>
}

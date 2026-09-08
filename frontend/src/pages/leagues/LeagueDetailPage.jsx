import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import PageTitle from '../../components/PageTitle'
import { ErrorMessage, EmptyState, Loading } from '../../components/Status'
import { getLeague, getLeagueScorers, getLeagueStandings, getLeagueWinner } from '../../services/leagueApi'
import { getLeagueParticipants } from '../../services/participantApi'
import { getLeagueTeams } from '../../services/teamApi'
import { getLeagueGames, getPlayerScores } from '../../services/gameApi'
import StandingsList from '../../components/StandingsList'
import LeagueStatusBadge from '../../components/LeagueStatusBadge'
import '../../styles/game-list.css'
import '../../styles/winner.css'
import '../../styles/standings.css'

const activeTabs = [['standings', '팀 순위'], ['games', '경기'], ['scorers', '개인 득점'], ['participants', '팀 · 참가자'], ['winner', '우승팀']]
const completedTabs = [['winner', '우승팀'], ['standings', '최종 순위'], ['scorers', '최종 개인 득점'], ['games', '경기 결과'], ['participants', '팀 · 참가자']]
const formatDate = value => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }) : '날짜 미정'

function ScorersList({ scorers }) {
  if (scorers.every(player => player.totalPoints === 0 && player.gamesScored === 0)) return <EmptyState text="아직 개인 득점 기록이 없습니다." />
  const leaders = scorers.filter(player => player.rank === 1)
  return <div className="scorer-list">{leaders.length > 0 && <section className="scorer-winner card"><small>{leaders.length > 1 ? '공동 득점 1위' : '득점 1위'}</small>{leaders.map(player => <div key={player.leagueMemberId}><h3>{player.memberName}</h3><b>{player.totalPoints}점</b></div>)}</section>}{scorers.map(player => <article className="scorer-card card" key={player.leagueMemberId}><b className="rank-number">{player.rank}위</b><div><strong>{player.memberName}</strong><span>{player.teamName || '미배정'} · 기록 경기 {player.gamesScored}회</span></div><div><strong>{player.totalPoints}점</strong><span>평균 {Number(player.averagePoints).toFixed(1)}점</span></div></article>)}</div>
}

function WinnerCard({ winner }) {
  if (!winner) return <EmptyState text="우승팀 미확정" />
  return <section className="winner-card card"><small>🏆 우승팀</small><h2>{winner.teamName}</h2><h3>우승 멤버</h3>{winner.members.length ? <div className="winner-members">{winner.members.map(member=><span key={member.memberId}>{member.name}</span>)}</div> : <p className="muted">배정된 우승 멤버가 없습니다.</p>}</section>
}

export default function LeagueDetailPage() {
  const { id } = useParams(); const [searchParams, setSearchParams] = useSearchParams(); const requestedTab = searchParams.get('tab'); const [league, setLeague] = useState(null); const [standings, setStandings] = useState(null); const [scorers, setScorers] = useState(null); const [winner, setWinner] = useState(undefined); const [participants, setParticipants] = useState(null); const [teams, setTeams] = useState([]); const [games, setGames] = useState(null); const [scores, setScores] = useState({}); const [tab, setTab] = useState(activeTabs.some(([key]) => key === requestedTab) ? requestedTab : null); const [error, setError] = useState('')
  useEffect(() => { getLeague(id).then(data => { setLeague(data); setTab(current => current || (data.status === 'COMPLETED' ? 'winner' : 'standings')) }).catch(() => setError('정보를 불러오지 못했습니다.')) }, [id])
  useEffect(() => { if (tab === 'standings') getLeagueStandings(id).then(data => setStandings(data.standings)).catch(() => setError('순위 정보를 불러오지 못했습니다.')); if (tab === 'scorers') getLeagueScorers(id).then(data => setScorers(data.scorers)).catch(() => setError('개인 득점 순위를 불러오지 못했습니다.')); if (tab === 'winner') getLeagueWinner(id).then(data => setWinner(data.winner)).catch(() => setError('우승팀 정보를 불러오지 못했습니다.')); if (tab === 'participants') Promise.all([getLeagueParticipants(id), getLeagueTeams(id)]).then(([p, t]) => { setParticipants(p); setTeams(t) }).catch(() => setError('참가자 정보를 불러오지 못했습니다.')); if (tab === 'games') getLeagueGames(id).then(setGames).catch(() => setError('경기 정보를 불러오지 못했습니다.')) }, [id, tab])
  const grouped = teams.map(t => ({ ...t, members: participants?.filter(p => Number(p.teamId) === Number(t.id)) || [] })); const unassigned = participants?.filter(p => !p.teamId) || []
  const showScores = gameId => { if (scores[gameId] !== undefined) return; getPlayerScores(gameId).then(data => setScores(s => ({ ...s, [gameId]: data }))).catch(() => setScores(s => ({ ...s, [gameId]: null }))) }
  if (error) return <><PageTitle title="리그 상세" back /><ErrorMessage text={error} /></>; if (!league || !tab) return <><PageTitle title="리그 상세" back /><Loading /></>
  const tabs = league.status === 'COMPLETED' ? completedTabs : activeTabs
  const selectTab = key => { setTab(key); setSearchParams({ tab: key }, { replace: true }) }
  if (tab === 'scorers') return <><PageTitle eyebrow="LEAGUE DETAIL" title={league.name} back /><div className="details card"><div className="row"><span>연도</span><b>{league.year}년</b></div><div className="row"><span>분기</span><b>{league.quarter}분기</b></div></div><div className="tabs">{tabs.map(([key, label]) => <button className={tab === key ? 'selected' : ''} key={key} onClick={() => selectTab(key)}>{label}</button>)}</div>{scorers === null ? <Loading /> : <ScorersList scorers={scorers} />}</>
  if (tab === 'winner') return <><PageTitle eyebrow="LEAGUE DETAIL" title={league.name} back /><div className="tabs">{tabs.map(([key, label]) => <button className={tab === key ? 'selected' : ''} key={key} onClick={() => selectTab(key)}>{label}</button>)}</div>{winner === undefined ? <Loading /> : <WinnerCard winner={winner} />}</>
  return <><PageTitle eyebrow="LEAGUE DETAIL" title={league.name} back /><div className="details card"><div className="row"><span>연도</span><b>{league.year}년</b></div><div className="row"><span>분기</span><b>{league.quarter}분기</b></div><div className="row"><span>상태</span><LeagueStatusBadge status={league.status} /></div></div><div className="tabs">{tabs.map(([key, label]) => <button className={tab === key ? 'selected' : ''} key={key} onClick={() => selectTab(key)}>{label}</button>)}</div>{tab === 'standings' ? standings === null ? <Loading /> : <StandingsList standings={standings} /> : tab === 'games' ? games === null ? <Loading /> : games.length === 0 ? <EmptyState text="등록된 경기가 없습니다." /> : <div className="game-list">{games.map(game => { const expanded = scores[game.gameId]; return <article className="card game-card" key={game.gameId}><div className="game-card-head"><b>{game.gameNo}경기</b><span className="game-status">{game.status === 'COMPLETED' ? '종료' : '예정'}</span></div><div className="game-match"><strong title={game.homeTeam.name}>{game.homeTeam.name}</strong><b className={game.status === 'COMPLETED' ? 'game-score' : 'game-vs'}>{game.status === 'COMPLETED' ? `${game.homeScore} : ${game.awayScore}` : 'VS'}</b><strong title={game.awayTeam.name}>{game.awayTeam.name}</strong></div><div className="game-date">{formatDate(game.gameDate)}</div>{game.status === 'COMPLETED' && <button className="score-toggle" onClick={() => showScores(game.gameId)}>개인 득점 보기 {expanded ? '▲' : '〉'}</button>}{expanded && <div className="score-details">{expanded.teams.map(team => <div className="score-team" key={team.teamId}><h4>{team.teamName}</h4>{team.players.filter(p => p.hasScore).map(p => <p key={p.leagueMemberId}><b>{p.name}</b><span>{p.points}점</span></p>)}{team.players.every(p => !p.hasScore) && <p className="muted">개인 득점 기록이 아직 입력되지 않았습니다.</p>}</div>)}</div>}</article> })}</div> : tab === 'participants' ? participants === null ? <Loading /> : <div className="team-groups">{grouped.map(t => <section className="card team-group" key={t.id}><h3>{t.name}</h3>{t.members.map(m => <p key={m.memberId}><b>{m.name}</b><span>{m.memberType === 'REGULAR' ? '정회원' : '게스트'}</span></p>)}</section>)}{unassigned.length > 0 && <section className="card team-group"><h3>미배정</h3>{unassigned.map(m => <p key={m.memberId}>{m.name}</p>)}</section>}</div> : <div className="empty card"><h3>아직 관련 정보가 없습니다.</h3></div>}</>
}

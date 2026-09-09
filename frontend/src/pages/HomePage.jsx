import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getLeagueStandings, getLeagues } from '../services/leagueApi'
import { getLeagueGames } from '../services/gameApi'
import { ErrorMessage, Loading } from '../components/Status'
import LeagueStatusBadge from '../components/LeagueStatusBadge'
import StandingsList from '../components/StandingsList'
import { selectCurrentLeague } from '../utils/league'
import '../styles/standings.css'
import '../styles/home.css'

const gameTime = game => new Date(game.scheduledAt || `${String(game.gameDate).slice(0, 10)}T00:00:00`).getTime()
const compareGames = (left, right) => gameTime(left) - gameTime(right) || Number(left.gameNo) - Number(right.gameNo) || Number(left.gameId) - Number(right.gameId)
const formatDate = game => new Date(game.scheduledAt || `${String(game.gameDate).slice(0, 10)}T00:00:00`).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
const isWinner = (game, teamId) => {
  if (game?.status !== 'COMPLETED' || game.homeScore == null || game.awayScore == null) return false
  const homeScore = Number(game.homeScore)
  const awayScore = Number(game.awayScore)
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore) || homeScore === awayScore) return false
  return homeScore > awayScore ? Number(teamId) === Number(game.homeTeam.id) : Number(teamId) === Number(game.awayTeam.id)
}

function FeaturedGame({ label, game, emptyText }) {
  const homeWon = isWinner(game, game?.homeTeam.id)
  const awayWon = isWinner(game, game?.awayTeam.id)

  return <article className="home-game card">
    <small>{label}</small>
    {game ? <>
      <div>
        <strong className={homeWon ? 'game-winner' : ''} title={game.homeTeam.name}>{game.homeTeam.name}</strong>
        {game.status === 'COMPLETED'
          ? <b className="home-game-score"><span className={homeWon ? 'game-winner' : ''}>{game.homeScore}</span><i>:</i><span className={awayWon ? 'game-winner' : ''}>{game.awayScore}</span></b>
          : <b>VS</b>}
        <strong className={awayWon ? 'game-winner' : ''} title={game.awayTeam.name}>{game.awayTeam.name}</strong>
      </div>
      <span>{formatDate(game)}</span>
    </> : <p className="muted">{emptyText}</p>}
  </article>
}

function RecentGames({ games }) {
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
    })}</div>
  </article>
}

export default function HomePage() {
  const [league, setLeague] = useState(null)
  const [standings, setStandings] = useState(null)
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getLeagues().then(async leagues => {
      const activeLeague = selectCurrentLeague(leagues)
      setLeague(activeLeague)
      if (!activeLeague) return
      const [standingData, gameData] = await Promise.all([getLeagueStandings(activeLeague.id), getLeagueGames(activeLeague.id)])
      setStandings(standingData.standings)
      setGames(gameData)
    }).catch(() => setError('현재 리그 정보를 불러오지 못했습니다.')).finally(() => setLoading(false))
  }, [])

  const completedGames = games.filter(game => game.status === 'COMPLETED')
  const latestCompletedDate = completedGames.map(game => String(game.gameDate).slice(0, 10)).sort().at(-1)
  const recentGames = completedGames.filter(game => String(game.gameDate).slice(0, 10) === latestCompletedDate).sort((left, right) => Number(left.gameNo) - Number(right.gameNo) || Number(left.gameId) - Number(right.gameId))
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
      <div className="home-games"><RecentGames games={recentGames} /><FeaturedGame label="다음 경기" game={scheduled} emptyText="다음 경기가 아직 등록되지 않았습니다." /></div>
    </section>
    <section className="home-links">
      <Link className="card" to={`/leagues/${league.id}?tab=participants`}><b>팀 · 참가자</b><span>현재 팀 편성 보기 →</span></Link>
      <Link className="card" to="/leagues"><b>지난 리그</b><span>전체 기록 보기 →</span></Link>
      <Link className="card champion-link" to="/champions"><b>🏆 역대 우승팀</b><span>분기별 우승 기록 보기 →</span></Link>
    </section>
  </>
}

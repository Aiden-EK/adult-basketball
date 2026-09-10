import { useState } from 'react'

const percent = value => value === null || value === undefined ? '-' : `${Number(value).toFixed(1)}%`
const impact = value => value === null || value === undefined ? '비교 데이터 없음' : `${value > 0 ? '+' : ''}${Number(value).toFixed(1)}%p`
const displayImpact = item => item.games > 0 && item.gamesWithoutPlayer === 0 ? '모든 경기 참석' : impact(item.winImpact)

function TeamDetail({ team }) {
  return <div className="win-impact-team"><div><b>{team.teamName}</b><span>{team.games}경기 · {team.wins}승 {team.losses}패</span></div><div><span>참가 {percent(team.winRate)}</span><span>미참가 {percent(team.winRateWithoutPlayer)}</span><strong className={team.winImpact > 0 ? 'positive' : team.winImpact < 0 ? 'negative' : ''}>{displayImpact(team)}</strong></div></div>
}

export default function WinImpactList({ players }) {
  const [expanded, setExpanded] = useState(null)
  if (!players?.length) return <div className="empty card"><p className="muted">승리기여도를 계산할 완료 경기와 출석 데이터가 없습니다.</p></div>
  const eligiblePlayers = players.filter(player => player.rankingEligible)
  const insufficientPlayers = players.filter(player => !player.rankingEligible)
  const renderPlayer = player => <article className={`win-impact-card card ${!player.rankingEligible ? 'insufficient' : ''}`} key={player.leagueMemberId}>
    <button type="button" className="win-impact-summary" onClick={() => setExpanded(expanded === player.leagueMemberId ? null : player.leagueMemberId)} aria-expanded={expanded === player.leagueMemberId}>
      <b className="win-impact-rank">{player.rankingEligible ? `${player.rank}위` : '·'}</b><span className="win-impact-name"><strong>{player.name}</strong><small>{player.games}경기 · {player.wins}승 {player.losses}패{player.games > 0 && player.gamesWithoutPlayer === 0 ? ' · 모든 경기 참석' : !player.rankingEligible && ' · 표본 부족'}</small></span><strong className={`win-impact-value ${player.winImpact > 0 ? 'positive' : player.winImpact < 0 ? 'negative' : ''}`}>{displayImpact(player)}</strong><span className="win-impact-chevron">{expanded === player.leagueMemberId ? '▲' : '›'}</span>
    </button>
    <div className="win-impact-metrics"><span>참가 승률 <b>{percent(player.winRate)}</b></span><span>미참가 승률 <b>{percent(player.weightedBaselineWinRate)}</b></span></div>
    {expanded === player.leagueMemberId && <div className="win-impact-teams">{player.teams.map(team => <TeamDetail team={team} key={team.teamId} />)}</div>}
  </article>
  return <div className="win-impact-sections"><div className="win-impact-list">{eligiblePlayers.map(renderPlayer)}</div>{insufficientPlayers.length > 0 && <section className="win-impact-insufficient"><div className="win-impact-subheading"><small>INSUFFICIENT SAMPLE</small><b>표본 부족</b></div><div className="win-impact-list">{insufficientPlayers.map(renderPlayer)}</div></section>}</div>
}

export { impact }

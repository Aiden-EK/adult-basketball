import { useState } from 'react'

const percent = value => value === null || value === undefined ? '-' : `${Number(value).toFixed(1)}%`
const impact = value => value === null || value === undefined ? '비교 데이터 없음' : `${value > 0 ? '+' : ''}${Number(value).toFixed(1)}%p`

function TeamDetail({ team, playerName }) {
  return <div className="win-impact-team"><b className="win-impact-team-name">{team.teamName}</b><div className="win-impact-team-lines"><span><b>팀 전체</b> {team.teamGames}경기 · {team.teamWins}승 {team.teamLosses}패 · {percent(team.teamWinRate)}</span><span className="win-impact-participation"><b>{playerName} 참가</b> {team.participatedGames}경기 · <em>{team.participatedWins}승</em> <em>{team.participatedLosses}패</em> · <em>{percent(team.participatedWinRate)}</em></span><strong className="win-impact-team-comparison">팀 평균 대비 {impact(team.winImpact)}</strong></div></div>
}

export default function WinImpactList({ players }) {
  const [expandedMemberIds, setExpandedMemberIds] = useState(() => new Set())
  if (!players?.length) return <div className="empty card"><p className="muted">승리기여도를 계산할 완료 경기와 출석 데이터가 없습니다.</p></div>
  const eligiblePlayers = players.filter(player => player.rankingEligible)
  const insufficientPlayers = players.filter(player => !player.rankingEligible)
  const togglePlayer = memberId => setExpandedMemberIds(previous => {
    const next = new Set(previous)
    if (next.has(memberId)) next.delete(memberId)
    else next.add(memberId)
    return next
  })
  const renderPlayer = player => <article className={`win-impact-card card ${!player.rankingEligible ? 'insufficient' : ''}`} key={player.leagueMemberId}>
    <button type="button" className="win-impact-summary" onClick={() => togglePlayer(player.leagueMemberId)} aria-expanded={expandedMemberIds.has(player.leagueMemberId)}>
      <b className="win-impact-rank">{player.rankingEligible ? `${player.rank}위` : '·'}</b><span className="win-impact-name"><strong>{player.name}</strong><small>{player.games}경기 · {player.wins}승 {player.losses}패{!player.rankingEligible && ' · 표본 부족'}</small></span><strong className={`win-impact-value ${player.winImpact > 0 ? 'positive' : player.winImpact < 0 ? 'negative' : ''}`}>{impact(player.winImpact)}</strong><span className="win-impact-chevron">{expandedMemberIds.has(player.leagueMemberId) ? '▲' : '›'}</span>
    </button>
    <div className="win-impact-metrics"><span>참가 승률 <b>{percent(player.winRate)}</b></span><span>팀 평균 <b>{percent(player.teamAverageWinRate)}</b></span></div>
    {expandedMemberIds.has(player.leagueMemberId) && <div className="win-impact-teams">{player.teams.map(team => <TeamDetail team={team} playerName={player.name} key={team.teamId} />)}</div>}
  </article>
  return <div className="win-impact-sections"><div className="win-impact-list">{eligiblePlayers.map(renderPlayer)}</div>{insufficientPlayers.length > 0 && <section className="win-impact-insufficient"><div className="win-impact-subheading"><small>INSUFFICIENT SAMPLE</small><b>표본 부족</b></div><div className="win-impact-list">{insufficientPlayers.map(renderPlayer)}</div></section>}</div>
}

export { impact }

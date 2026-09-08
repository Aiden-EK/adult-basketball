import { useState } from 'react'
import { EmptyState } from './Status'

const formatWinRate = value => `${(Number(value) * 100).toFixed(1)}%`
const formatDifference = value => `${Number(value) > 0 ? '+' : ''}${value}`

export default function StandingsList({ standings }) {
  const [expandedTeamId, setExpandedTeamId] = useState(null)

  if (standings.length === 0) return <EmptyState text="등록된 팀이 없습니다." />

  return <div className="standings-list">
    {standings.map(team => {
      const expanded = expandedTeamId === team.teamId
      return <article className={`standing-card card rank-${team.rank}`} key={team.teamId}>
        <button className="standing-summary" type="button" aria-expanded={expanded} onClick={() => setExpandedTeamId(expanded ? null : team.teamId)}>
          <b className="rank-number">{team.rank}</b>
          <span className="standing-team" title={team.teamName}>{team.teamName}</span>
          <span className="standing-record"><b>{team.wins}승 {team.losses}패</b><small>{formatWinRate(team.winRate)}</small></span>
          <span className={`standing-difference ${team.pointDifference > 0 ? 'positive' : team.pointDifference < 0 ? 'negative' : ''}`}><b>{formatDifference(team.pointDifference)}</b><small>득실차</small></span>
          <span className="standing-expand" aria-hidden="true">{expanded ? '−' : '+'}</span>
        </button>
        {expanded && <div className="standing-details">
          <dl><div><dt>경기</dt><dd>{team.gamesPlayed}</dd></div><div><dt>득점</dt><dd>{team.pointsFor}</dd></div><div><dt>실점</dt><dd>{team.pointsAgainst}</dd></div><div><dt>연승</dt><dd>{team.currentWinStreak > 0 ? `${team.currentWinStreak}연승` : '-'}</dd></div></dl>
          <div className="head-to-head"><b>상대전적</b>{team.headToHead?.length ? team.headToHead.map(record => <span key={record.opponentTeamId}>vs {record.opponentTeamName} {record.wins}승 {record.losses}패</span>) : <span>경기 기록 없음</span>}</div>
        </div>}
      </article>
    })}
  </div>
}

import { useWinningCombinations } from '../utils/useWinningCombinations'
import { ErrorMessage, Loading } from './Status'
import { impact } from './WinImpactList'
import '../styles/winning-combinations.css'

export default function WinningCombinations({ leagueId, admin = false }) {
  const state = useWinningCombinations(leagueId, admin)
  return <WinningCombinationsSection {...state} admin={admin} />
}

export function WinningCombinationsSection({ result, error, admin = false }) {
  return <section className={`home-section winning-combinations ${admin ? 'winning-combinations-admin' : ''}`} aria-label={`필승조합 TOP${admin ? 20 : 7}`}>
    <div className="section-head"><div><small>WINNING COMBINATIONS</small><h2>필승조합 TOP{admin ? 20 : 7}</h2></div></div>
    <p className="combination-description">3인 이상 · 함께 출전 {result?.minGames ?? 3}경기 이상</p>
    {error ? <ErrorMessage text={error} /> : !result ? <Loading /> : !result.items.length
      ? <div className="empty card"><p className="muted">아직 집계할 필승조합 데이터가 없습니다.</p></div>
      : <ol className="combination-list card">{result.items.map(item => <li className={`combination-row ${item.rank === 1 ? 'combination-first' : ''}`} key={item.key}>
        <b className="combination-rank">{item.rank}위</b>
        <div className="combination-content">
          <div className="combination-heading"><span>{item.teamName} · {item.memberCount}인 · 함께 출전 {item.gamesPlayed}경기</span><strong className="combination-rate">{item.combinationWinRate.toFixed(1)}%</strong></div>
          <strong className="combination-names">{item.members.map(member => member.name).join(' · ')}</strong>
          <div className="combination-footer"><span className="combination-record">{item.wins}승 {item.losses}패</span><div className="combination-comparison"><span>팀 평균 {item.teamWinRate.toFixed(1)}% 대비</span><strong className={item.winImpact < 0 ? 'negative' : ''}>{impact(item.winImpact)}</strong></div></div>
        </div>
      </li>)}</ol>}
  </section>
}

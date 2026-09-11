import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useWinningCombinations } from '../utils/useWinningCombinations'
import { ErrorMessage, Loading } from './Status'
import { impact } from './WinImpactList'
import '../styles/winning-combinations.css'

export default function WinningCombinations({ leagueId, admin = false }) {
  const state = useWinningCombinations(leagueId, admin)
  return <TeamCombinationRanking {...state} admin={admin} />
}

function orderedTeams(teams = []) {
  const order = ['블랙', '화이트', '컬러']
  const position = name => order.includes(name) ? order.indexOf(name) : order.length
  return [...teams].sort((a, b) => position(a.teamName) - position(b.teamName) || a.teamSortOrder - b.teamSortOrder || a.teamId - b.teamId)
}

function CombinationRow({ item, showTeam = false }) {
  return <li className={`combination-row ${item.rank === 1 ? 'combination-first' : ''}`}>
    <b className="combination-rank">{item.rank}위</b>
    <div className="combination-content">
      <div className="combination-heading"><span>{showTeam && <><b>{item.teamName}</b> · </>}{item.memberCount}인 · 함께 출전 {item.gamesPlayed}경기</span><strong className="combination-rate">{item.combinationWinRate.toFixed(1)}%</strong></div>
      <strong className="combination-names">{item.members.map(member => member.name).join(' · ')}</strong>
      <div className="combination-footer"><span className="combination-record">{item.wins}승 {item.losses}패</span><div className="combination-comparison"><span>팀 평균 {item.teamWinRate.toFixed(1)}% 대비</span><strong className={item.winImpact < 0 ? 'negative' : ''}>{impact(item.winImpact)}</strong></div></div>
    </div>
  </li>
}

export function WinningCombinationsSection({ result, error, leagueId }) {
  return <section className="home-section winning-combinations" aria-label="필승조합 미리보기">
    <div className="section-head"><div><small>WINNING COMBINATIONS</small><h2>필승조합</h2></div><Link className="text-link" to={`/leagues/${leagueId}/winning-combinations`}>전체보기 →</Link></div>
    <p className="combination-description">팀별 1위 · 3인 이상 · 함께 출전 {result?.minGames ?? 3}경기 이상</p>
    {error ? <ErrorMessage text={error} /> : !result ? <Loading /> : !result.teams.length ? <div className="empty card"><p className="muted">아직 집계할 필승조합 데이터가 없습니다.</p></div> : <ul className="combination-list card">{orderedTeams(result.teams).map(team => team.items[0]
      ? <CombinationRow key={team.teamId} item={team.items[0]} showTeam />
      : <li className="combination-empty-team" key={team.teamId}><b>{team.teamName}</b><span>집계 가능한 조합 없음</span></li>)}</ul>}
  </section>
}

function TeamCombinationRanking({ result, error, admin }) {
  const [teamId, setTeamId] = useState(null)
  const teams = orderedTeams(result?.teams)
  const selectedTeam = teams.find(team => team.teamId === teamId) || teams[0]
  return <section className={`winning-combinations ${admin ? 'winning-combinations-admin' : ''}`} aria-label={`팀별 필승조합 TOP${admin ? 20 : 7}`}>
    <div className="section-head"><div><small>WINNING COMBINATIONS</small><h2>{admin ? '필승조합 · 팀별 TOP20' : '팀별 TOP7'}</h2></div></div>
    <p className="combination-description">3인 이상 · 함께 출전 {result?.minGames ?? 3}경기 이상</p>
    {error ? <ErrorMessage text={error} /> : !result ? <Loading /> : !selectedTeam
      ? <div className="empty card"><p className="muted">아직 집계할 필승조합 데이터가 없습니다.</p></div>
      : <>
        <div className="tabs combination-tabs" aria-label="필승조합 팀 선택">{teams.map(team => <button type="button" className={selectedTeam.teamId === team.teamId ? 'selected' : ''} aria-pressed={selectedTeam.teamId === team.teamId} onClick={() => setTeamId(team.teamId)} key={team.teamId}>{team.teamName}</button>)}</div>
        <div className="combination-baseline card"><strong>{selectedTeam.teamName} 팀 평균</strong><span>{selectedTeam.teamGamesPlayed}경기 · {selectedTeam.teamWins}승 {selectedTeam.teamLosses}패 · 평균 승률 <b>{selectedTeam.teamWinRate == null ? '-' : `${selectedTeam.teamWinRate.toFixed(1)}%`}</b></span></div>
        {selectedTeam.items.length ? <ol className="combination-list card">{selectedTeam.items.map(item => <CombinationRow key={item.key} item={item} />)}</ol>
          : <div className="empty card"><p className="muted">집계 가능한 조합 없음</p></div>}
      </>}
  </section>
}

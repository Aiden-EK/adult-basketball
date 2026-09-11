import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageTitle from '../../components/PageTitle'
import { EmptyState, ErrorMessage, Loading } from '../../components/Status'
import { getLeagues } from '../../services/leagueApi'
import LeagueStatusBadge from '../../components/LeagueStatusBadge'
import WinningCombinations from '../../components/WinningCombinations'
import { selectCurrentLeague } from '../../utils/league'

export default function AdminLeagueListPage() {
  const [data, setData] = useState(null)
  const [leagueId, setLeagueId] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    getLeagues().then(leagues => {
      setData(leagues)
      setLeagueId(String((selectCurrentLeague(leagues) || leagues[0])?.id || ''))
    }).catch(() => setError('데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'))
  }, [])
  return <>
    <PageTitle eyebrow="ADMIN · LEAGUES" title="리그 관리" description="분기 리그를 조회하고 생성합니다." />
    <Link className="primary full create-link" to="/admin/leagues/new">+ 새 리그 만들기</Link>
    {error ? <ErrorMessage text={error} /> : data === null ? <Loading /> : data.length === 0 ? <EmptyState text="등록된 리그가 없습니다." /> : <>
      <div className="compact-list league-admin-list">{data.map(league => <Link className="league-card compact-card card" key={league.id} to={`/leagues/${league.id}`}><div><div className="compact-meta"><span className="compact-quarter">{league.quarter}분기</span><label>{league.year}년</label></div><h3>{league.name}</h3><LeagueStatusBadge status={league.status} /></div><span className="round">→</span></Link>)}</div>
      <label className="field"><span>필승조합 조회 리그</span><select className="league-select" aria-label="필승조합 조회 리그" value={leagueId} onChange={event => setLeagueId(event.target.value)}>{data.map(league => <option key={league.id} value={league.id}>{league.name}</option>)}</select></label>
      <WinningCombinations key={leagueId} leagueId={leagueId} admin />
    </>}
  </>
}

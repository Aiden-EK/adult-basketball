import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageTitle from '../../components/PageTitle'
import { EmptyState, ErrorMessage, Loading } from '../../components/Status'
import { getLeagues } from '../../services/leagueApi'
import LeagueStatusBadge from '../../components/LeagueStatusBadge'
export default function AdminLeagueListPage() { const [data, setData] = useState(null); const [error, setError] = useState(''); useEffect(() => { getLeagues().then(setData).catch(() => setError('데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')) }, []); return <><PageTitle eyebrow="ADMIN · LEAGUES" title="리그 관리" description="분기 리그를 조회하고 생성합니다." /><Link className="primary full create-link" to="/admin/leagues/new">+ 새 리그 만들기</Link>{error ? <ErrorMessage text={error} /> : data === null ? <Loading /> : data.length === 0 ? <EmptyState text="등록된 리그가 없습니다." /> : <div className="compact-list league-admin-list">{data.map((league) => <Link className="league-card compact-card card" key={league.id} to={`/leagues/${league.id}`}><div><div className="compact-meta"><span className="compact-quarter">{league.quarter}분기</span><label>{league.year}년</label></div><h3>{league.name}</h3><LeagueStatusBadge status={league.status} /></div><span className="round">→</span></Link>)}</div>}</> }

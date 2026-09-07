import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageTitle from '../../components/PageTitle'
import { EmptyState, ErrorMessage, Loading } from '../../components/Status'
import { getLeagues } from '../../services/leagueApi'
export default function LeagueListPage() { const [data, setData] = useState(null); const [error, setError] = useState(''); useEffect(() => { getLeagues().then(setData).catch(() => setError('정보를 불러오지 못했습니다.')) }, []); return <><PageTitle eyebrow="LEAGUES" title="리그 목록" description="지난 기록부터 현재 리그까지 확인하세요." />{error && <ErrorMessage text={error} />}{data === null ? <Loading /> : data.length === 0 ? <EmptyState text="등록된 리그가 없습니다." /> : <div className="stack">{data.map((league) => <Link className="league-card card" key={league.id} to={`/leagues/${league.id}`}><div><label>{league.year} · {league.quarter}분기</label><h3>{league.name}</h3><i>{league.status}</i></div><span className="round">→</span></Link>)}</div>}</> }

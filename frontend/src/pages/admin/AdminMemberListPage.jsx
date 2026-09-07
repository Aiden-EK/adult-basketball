import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageTitle from '../../components/PageTitle'
import { ErrorMessage, Loading } from '../../components/Status'
import { getAdminMembers } from '../../services/memberApi'
export default function AdminMemberListPage() { const [data, setData] = useState(null); const [error, setError] = useState(''); useEffect(() => { getAdminMembers().then(setData).catch(() => setError('정보를 불러오지 못했습니다.')) }, []); return <><PageTitle eyebrow="ADMIN · MEMBERS" title="회원 관리" description="관리자용 회원 목록입니다." />{error && <ErrorMessage />}{data === null ? <Loading /> : <div className="stack">{data.map((member) => <Link className="league-card card" key={member.id} to={`/admin/members/${member.id}`}><div><h3>{member.name}</h3><p className="muted">{member.memberType === 'REGULAR' ? '정회원' : '게스트'} · {member.isActive ? '활성' : '비활성'}</p></div><span className="round">→</span></Link>)}</div>}</> }

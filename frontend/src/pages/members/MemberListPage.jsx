import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageTitle from '../../components/PageTitle'
import { EmptyState, ErrorMessage, Loading } from '../../components/Status'
import { getMembers } from '../../services/memberApi'
export default function MemberListPage() { const [members, setMembers] = useState(null); const [error, setError] = useState(''); useEffect(() => { getMembers().then(setMembers).catch(() => setError('회원 정보를 불러오지 못했습니다.')) }, []); return <><PageTitle eyebrow="MEMBERS" title="회원" description="현재 활동 중인 회원 목록입니다." />{error ? <ErrorMessage text={error} /> : members === null ? <Loading /> : members.length === 0 ? <EmptyState text="활동 중인 회원이 없습니다." /> : <div className="compact-list">{members.map((member) => <Link className="league-card compact-card member-compact-card card" key={member.id} to={`/members/${member.id}`}><div><h3>{member.name}</h3><p className="muted">{member.memberType === 'REGULAR' ? '정회원' : '게스트'}</p></div><span className="round">→</span></Link>)}</div>}</> }

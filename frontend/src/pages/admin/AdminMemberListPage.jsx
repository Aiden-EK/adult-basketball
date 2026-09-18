import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageTitle from '../../components/PageTitle'
import { EmptyState, ErrorMessage, Loading } from '../../components/Status'
import { getAdminMembers } from '../../services/memberApi'
function sortMembersByName(members) {
  return [...members].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
}

function MemberGroup({ title, members }) {
  if (members.length === 0) return null
  return <section className="member-group"><h2 className="member-group-heading">{title}</h2><div className="member-list">{sortMembersByName(members).map(member => <Link className={`member-cell${member.isActive ? '' : ' member-cell-inactive'}`} key={member.id} to={`/admin/members/${member.id}`}><div className="member-cell-name"><b>{member.name}</b><span aria-hidden="true">›</span></div><p className="member-cell-meta"><span className="member-birth-year">{member.birthYear == null ? '연도 미등록' : `${member.birthYear}년`}</span><i>·</i><span className={member.memberType === 'GUEST' ? 'member-guest' : ''}>{member.memberType === 'REGULAR' ? '정회원' : '게스트'}</span><i>·</i><span className={member.isActive ? 'member-active' : 'member-inactive'}>{member.isActive ? '활성' : '비활성'}</span></p></Link>)}</div></section>
}

export default function AdminMemberListPage() { const [data, setData] = useState(null); const [query, setQuery] = useState(''); const [error, setError] = useState(''); useEffect(() => { getAdminMembers().then(setData).catch(() => setError('데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')) }, []); const filtered = useMemo(() => (data || []).filter(member => member.name.includes(query)), [data, query]); const regularMembers = filtered.filter(member => member.memberType === 'REGULAR'); const guestMembers = filtered.filter(member => member.memberType === 'GUEST'); return <><PageTitle eyebrow="ADMIN · MEMBERS" title="회원 관리" description="회원 등록, 수정, 상태 관리를 합니다." /><Link className="primary full create-link" to="/admin/members/new">+ 새 회원 등록</Link><input className="search-input" value={query} onChange={event => setQuery(event.target.value)} placeholder="이름으로 검색" />{error ? <ErrorMessage text={error} /> : data === null ? <Loading /> : data.length === 0 ? <EmptyState text="등록된 회원이 없습니다." /> : filtered.length === 0 ? <EmptyState text="검색 결과가 없습니다." /> : <div className="member-groups"><MemberGroup title="정회원" members={regularMembers} /><MemberGroup title="게스트" members={guestMembers} /></div>}</> }

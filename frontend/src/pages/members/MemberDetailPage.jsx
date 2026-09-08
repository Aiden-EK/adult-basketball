import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import PageTitle from '../../components/PageTitle'
import { ErrorMessage, Loading } from '../../components/Status'
import { getMember } from '../../services/memberApi'
export default function MemberDetailPage() { const { id } = useParams(); const [member, setMember] = useState(null); const [error, setError] = useState(''); useEffect(() => { getMember(id).then(setMember).catch(() => setError('회원 정보를 불러오지 못했습니다.')) }, [id]); return <><PageTitle eyebrow="MEMBER" title={member?.name || '회원 상세'} back />{error ? <ErrorMessage text={error} /> : !member ? <Loading /> : <><div className="details card"><div className="row"><span>회원 구분</span><b>{member.memberType === 'REGULAR' ? '정회원' : '게스트'}</b></div></div><div className="empty card"><h3>추가 회원 정보는 추후 제공 예정입니다.</h3><p className="muted">참가 리그, 출석률, 우승 기록을 준비하고 있습니다.</p></div></>}</> }

import { Link } from 'react-router-dom'
import PageTitle from '../../components/PageTitle'
const menus = [['leagues', '리그 관리', '분기 리그를 만들고 조회합니다.'], ['members', '회원 관리', '회원정보와 관리자 비고를 관리합니다.'], ['participants', '참가자 관리', '리그 참가자를 관리합니다.'], ['teams', '팀 관리', '리그별 팀을 관리합니다.'], ['games', '경기 관리', '경기 일정과 결과를 관리합니다.'], ['attendance', '출석 관리', '경기일별 출석을 관리합니다.'], ['champions', '우승팀 관리', '리그 우승팀을 확정합니다.']]
export default function AdminHomePage() { return <><PageTitle eyebrow="ADMIN" title="관리자 메뉴" description="관리 기능을 선택하세요." /><div className="admin-grid">{menus.map(([path, title, desc]) => <Link className="admin-card card" key={path} to={`/admin/${path}`}><strong>{title}</strong><span>{desc}</span><b>→</b></Link>)}</div></> }

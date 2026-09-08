import { Link } from 'react-router-dom'
import PageTitle from '../../components/PageTitle'
const menus = [['leagues', '리그 관리', '분기 리그 조회와 생성'], ['members', '회원 관리', '회원 등록과 상태 관리'], ['participants', '참가자 관리', '리그 참가 회원 관리'], ['teams', '팀 관리', '리그별 팀 관리'], ['games', '경기 관리', '경기 일정과 결과 관리'], ['attendance', '출석 관리', '경기일별 출석 관리'], ['champions', '우승팀 관리', '리그 우승팀 관리']]
export default function AdminHomePage() { return <><PageTitle eyebrow="ADMIN" title="관리자 메뉴" description="관리 기능을 선택하세요." /><div className="admin-grid">{menus.map(([path, title, desc]) => <Link className="admin-card admin-menu-card card" key={path} to={`/admin/${path}`}><strong>{title}</strong><span>{desc}</span><b>→</b></Link>)}</div></> }

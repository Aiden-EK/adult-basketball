import { buildAttendanceRanking, formatAttendanceRate } from '../utils/attendanceRanking'
import '../styles/attendance-ranking.css'

function RankingGroup({ title, type, participants, totalAttendanceDays, limit }) {
  const ranking = buildAttendanceRanking(participants.filter(participant => participant.memberType === type))
  const visibleRanking = limit == null ? ranking : ranking.slice(0, limit)
  const isGuest = type === 'GUEST'

  return <section className="attendance-ranking-group">
    <div className="attendance-ranking-heading"><h2 className={isGuest ? 'attendance-ranking-guest' : ''}>{title}</h2><span>{visibleRanking.length}명</span></div>
    {visibleRanking.length === 0
      ? <div className="empty card attendance-ranking-empty"><p className="muted">등록된 {title}이 없습니다.</p></div>
      : <div className="attendance-ranking-list card">{visibleRanking.map(participant => <article className="attendance-ranking-row" key={participant.leagueMemberId}>
        <b className={`attendance-ranking-rank ${isGuest ? 'guest' : ''}`}>{participant.rank}위</b>
        <span className="attendance-ranking-name"><strong className={isGuest ? 'attendance-ranking-guest' : ''}>{participant.name}</strong><small>{participant.attendanceCount} / {totalAttendanceDays}회 참석</small></span>
        <strong className="attendance-ranking-rate">{formatAttendanceRate(participant.attendanceRate)}</strong>
      </article>)}</div>}
  </section>
}

export default function AttendanceRanking({ data, isAdmin = false }) {
  if (data.totalAttendanceDays === 0) return <div className="empty card attendance-ranking-no-data"><p className="muted">아직 출석 기록이 없습니다.</p></div>
  return <div className="attendance-ranking-groups">
    <RankingGroup title={isAdmin ? '정회원 (관리자 전체조회)' : '정회원 TOP10'} type="REGULAR" participants={data.participants} totalAttendanceDays={data.totalAttendanceDays} limit={isAdmin ? undefined : 10} />
    <RankingGroup title={isAdmin ? '게스트 (관리자 전체조회)' : '게스트 TOP10'} type="GUEST" participants={data.participants} totalAttendanceDays={data.totalAttendanceDays} limit={isAdmin ? undefined : 10} />
  </div>
}

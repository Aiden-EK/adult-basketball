import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import PageTitle from '../components/PageTitle'
import { ErrorMessage, Loading } from '../components/Status'
import { getLeagueAttendanceRates } from '../services/gameApi'
import { buildAttendanceRanking, formatAttendanceRate } from '../utils/attendanceRanking'
import '../styles/attendance-ranking.css'

function RankingGroup({ title, type, participants, totalAttendanceDays }) {
  const ranking = buildAttendanceRanking(participants.filter(participant => participant.memberType === type))
  const visibleRanking = ranking.slice(0, 7)
  const isGuest = type === 'GUEST'

  return <section className="attendance-ranking-group">
    <div className="attendance-ranking-heading"><h2 className={isGuest ? 'attendance-ranking-guest' : ''}>{title} TOP 7</h2><span>{visibleRanking.length}명</span></div>
    {visibleRanking.length === 0
      ? <div className="empty card attendance-ranking-empty"><p className="muted">등록된 {title}이 없습니다.</p></div>
      : <div className="attendance-ranking-list card">{visibleRanking.map(participant => <article className="attendance-ranking-row" key={participant.leagueMemberId}>
        <b className={`attendance-ranking-rank ${isGuest ? 'guest' : ''}`}>{participant.rank}위</b>
        <span className="attendance-ranking-name"><strong className={isGuest ? 'attendance-ranking-guest' : ''}>{participant.name}</strong><small>{participant.attendanceCount} / {totalAttendanceDays}회 참석</small></span>
        <strong className="attendance-ranking-rate">{formatAttendanceRate(participant.attendanceRate)}</strong>
      </article>)}</div>}
  </section>
}

export default function AttendanceRankingPage() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getLeagueAttendanceRates(id).then(setData).catch(() => setError('출석 순위를 불러오지 못했습니다.'))
  }, [id])

  return <>
    <PageTitle eyebrow="ATTENDANCE RANKING" title="출석왕" description="리그 출석 기록을 기준으로 계산한 참석률입니다." back />
    {error ? <ErrorMessage text={error} /> : !data ? <Loading /> : data.totalAttendanceDays === 0
      ? <div className="empty card attendance-ranking-no-data"><p className="muted">아직 출석 기록이 없습니다.</p></div>
      : <div className="attendance-ranking-groups">
        <RankingGroup title="정회원" type="REGULAR" participants={data.participants} totalAttendanceDays={data.totalAttendanceDays} />
        <RankingGroup title="게스트" type="GUEST" participants={data.participants} totalAttendanceDays={data.totalAttendanceDays} />
      </div>}
  </>
}

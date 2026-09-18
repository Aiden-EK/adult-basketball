import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import PageTitle from '../components/PageTitle'
import { ErrorMessage, Loading } from '../components/Status'
import AttendanceRanking from '../components/AttendanceRanking'
import { getLeagueAttendanceRates } from '../services/gameApi'
import { useAuth } from '../auth/useAuth'

export default function AttendanceRankingPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getLeagueAttendanceRates(id).then(setData).catch(() => setError('출석 순위를 불러오지 못했습니다.'))
  }, [id])

  return <>
    <PageTitle eyebrow="ATTENDANCE RANKING" title="출석왕" description="리그 출석 기록을 기준으로 계산한 참석률입니다." back />
    {error ? <ErrorMessage text={error} /> : !data ? <Loading /> : <AttendanceRanking data={data} isAdmin={isAdmin} />}
  </>
}

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import PageTitle from '../components/PageTitle'
import WinningCombinations from '../components/WinningCombinations'
import { ErrorMessage, Loading } from '../components/Status'
import { getLeague } from '../services/leagueApi'

export default function WinningCombinationsPage() {
  const { id } = useParams()
  const [state, setState] = useState(null)
  useEffect(() => {
    let cancelled = false
    getLeague(id).then(league => { if (!cancelled) setState({ id, league }) })
      .catch(() => { if (!cancelled) setState({ id, error: '리그 정보를 불러오지 못했습니다.' }) })
    return () => { cancelled = true }
  }, [id])
  const current = state?.id === id ? state : null
  return <>
    <PageTitle eyebrow="WINNING COMBINATIONS" title="필승조합" description={current?.league?.name} back />
    {current?.error ? <ErrorMessage text={current.error} /> : !current ? <Loading /> : <WinningCombinations key={id} leagueId={id} />}
  </>
}

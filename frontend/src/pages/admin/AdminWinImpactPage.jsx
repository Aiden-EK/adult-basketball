import { useEffect, useState } from 'react'
import PageTitle from '../../components/PageTitle'
import { EmptyState, ErrorMessage, Loading } from '../../components/Status'
import WinImpactList from '../../components/WinImpactList'
import { getLeagues, getLeagueWinImpact } from '../../services/leagueApi'
import { selectCurrentLeague } from '../../utils/league'

export default function AdminWinImpactPage() {
  const [leagues, setLeagues] = useState(null)
  const [leagueId, setLeagueId] = useState('')
  const [winImpact, setWinImpact] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getLeagues().then(items => {
      setLeagues(items)
      setLeagueId(String((selectCurrentLeague(items) || items[0])?.id || ''))
    }).catch(() => setError('리그 정보를 불러오지 못했습니다.'))
  }, [])

  useEffect(() => {
    if (!leagueId) return
    getLeagueWinImpact(leagueId).then(setWinImpact).catch(() => setError('승리기여도 정보를 불러오지 못했습니다.'))
  }, [leagueId])

  function selectLeague(event) {
    setLeagueId(event.target.value)
    setWinImpact(null)
    setError('')
  }

  return <>
    <PageTitle eyebrow="ADMIN · WIN IMPACT" title="승리기여도 관리" description="공식 전체 순위와 표본 부족 회원을 조회합니다." back />
    {error && <ErrorMessage text={error} />}
    {leagues === null ? <Loading /> : leagues.length === 0 ? <EmptyState text="등록된 리그가 없습니다." /> : <>
      <label className="field"><span>조회 리그</span><select className="league-select" aria-label="승리기여도 조회 리그" value={leagueId} onChange={selectLeague}>{leagues.map(league => <option key={league.id} value={league.id}>{league.name}</option>)}</select></label>
      <div className="win-impact-heading"><small>OFFICIAL RANKING</small><h2>공식 승리기여도 전체 순위</h2><p>최소 6경기를 충족한 회원 전체를 표시합니다.<br /><strong className="win-impact-forfeit-note">몰수패/승 경기기록은 승률계산에서 제외됩니다.</strong></p></div>
      {winImpact === null ? !error && <Loading /> : <WinImpactList players={winImpact.players} />}
    </>}
  </>
}

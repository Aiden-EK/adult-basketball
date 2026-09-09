import { useEffect, useState } from 'react'
import PageTitle from '../components/PageTitle'
import { EmptyState, ErrorMessage, Loading } from '../components/Status'
import { getLeagueChampions } from '../services/leagueApi'
import '../styles/winner.css'

export default function ChampionsPage() {
  const [champions, setChampions] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getLeagueChampions().then(setChampions).catch(() => setError('역대 우승팀 정보를 불러오지 못했습니다.'))
  }, [])

  return <>
    <PageTitle eyebrow="HALL OF CHAMPIONS" title="역대 우승팀" description="분기별 우승팀과 당시 우승 멤버를 확인하세요." back />
    {error ? <ErrorMessage text={error} /> : champions === null ? <Loading /> : champions.length === 0 ? <EmptyState text="확정된 우승팀 기록이 없습니다." /> : <div className="champion-history">
      {champions.map(champion => <article className="winner-card champion-history-card card" key={champion.leagueId}>
        <small>{champion.year}년 {champion.quarter}분기</small>
        <h2>🏆 {champion.winnerTeam.teamName}</h2>
        <h3>우승 멤버</h3>
        {champion.members.length ? <div className="winner-members">{champion.members.map(member => <span className={member.isCaptain ? 'captain-pill' : ''} key={member.memberId}>{member.isCaptain ? '👑 주장 ' : ''}{member.name}</span>)}</div> : <p className="muted">등록된 우승 멤버가 없습니다.</p>}
      </article>)}
    </div>}
  </>
}

import { useEffect, useState } from 'react'
import PageTitle from '../../components/PageTitle'; import { ErrorMessage, Loading } from '../../components/Status'
import { getLeagues, getLeagueWinner, updateLeagueWinner } from '../../services/leagueApi'; import { getLeagueTeams } from '../../services/teamApi'
import '../../styles/winner.css'
export default function AdminChampionsPage() {
  const [leagues,setLeagues]=useState(null),[leagueId,setLeagueId]=useState(''),[teams,setTeams]=useState([]),[teamId,setTeamId]=useState(''),[winner,setWinner]=useState(null),[error,setError]=useState(''),[saved,setSaved]=useState('')
  useEffect(()=>{getLeagues().then(data=>{setLeagues(data);if(data.length)setLeagueId(String(data[0].id))}).catch(()=>setError('리그를 불러오지 못했습니다.'))},[])
  useEffect(()=>{if(!leagueId)return;Promise.all([getLeagueTeams(leagueId),getLeagueWinner(leagueId)]).then(([teamRows,winnerData])=>{setTeams(teamRows);setWinner(winnerData.winner);setTeamId(winnerData.winner?String(winnerData.winner.teamId):'')}).catch(()=>setError('우승팀 정보를 불러오지 못했습니다.'))},[leagueId])
  if(leagues===null)return <><PageTitle title="우승팀 관리" back/><Loading/></>
  const league=leagues.find(item=>String(item.id)===leagueId);const save=async()=>{setError('');setSaved('');try{const result=await updateLeagueWinner(leagueId,Number(teamId));setWinner(result.winner);setSaved('우승팀을 저장했습니다.')}catch(e){setError(e.message)}}
  return <><PageTitle eyebrow="ADMIN · CHAMPION" title="우승팀 관리" description="종료된 리그의 최종 우승팀을 확정합니다."/><label className="select-label">리그 선택</label><select className="league-select" value={leagueId} onChange={e=>setLeagueId(e.target.value)}>{leagues.map(item=><option key={item.id} value={item.id}>{item.year}년 {item.quarter}분기 · {item.name}</option>)}</select>{error&&<ErrorMessage text={error}/>}<section className="card champion-admin"><h3>{winner?`현재 우승팀: ${winner.teamName}`:'현재 우승팀 미확정'}</h3>{league?.status==='COMPLETED'?<><label className="select-label">우승팀</label><select className="league-select" value={teamId} onChange={e=>setTeamId(e.target.value)}><option value="">팀을 선택하세요</option>{teams.map(team=><option key={team.id} value={team.id}>{team.name}</option>)}</select><button className="primary full" disabled={!teamId} onClick={save}>우승팀 저장</button>{saved&&<p className="success">{saved}</p>}</>:<p className="muted">리그 종료 후 우승팀을 확정할 수 있습니다.</p>}</section></>
}

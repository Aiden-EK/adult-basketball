import { useCallback, useEffect, useState } from 'react'
import PageTitle from '../../components/PageTitle'
import { EmptyState, ErrorMessage, Loading } from '../../components/Status'
import { getLeagues } from '../../services/leagueApi'
import { getAdminLeagueParticipants } from '../../services/participantApi'
import { createAdminTeam, deleteAdminTeam, getAdminLeagueTeams, updateAdminTeam, updateTeamAssignments, updateTeamCaptain } from '../../services/teamApi'

export default function AdminTeamsPage() {
  const [leagues, setLeagues] = useState(null)
  const [leagueId, setLeagueId] = useState('')
  const [teams, setTeams] = useState(null)
  const [members, setMembers] = useState(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async selectedLeagueId => {
    if (!selectedLeagueId) return
    try {
      const [teamData, memberData] = await Promise.all([getAdminLeagueTeams(selectedLeagueId), getAdminLeagueParticipants(selectedLeagueId)])
      setTeams(teamData)
      setMembers(memberData.filter(member => member.isParticipant))
      setError('')
    } catch (loadError) {
      setError(loadError.message)
    }
  }, [])

  useEffect(() => {
    getLeagues().then(data => {
      setLeagues(data)
      if (data[0]) {
        const selectedLeagueId = String(data[0].id)
        setLeagueId(selectedLeagueId)
        load(selectedLeagueId)
      }
      else { setTeams([]); setMembers([]) }
    }).catch(loadError => { setError(loadError.message); setLeagues([]) })
  }, [load])

  const changeLeague = value => {
    setTeams(null)
    setMembers(null)
    setError('')
    setLeagueId(value)
    load(value)
  }

  async function add() {
    if (!name.trim()) return setError('팀 이름은 필수입니다.')
    try { await createAdminTeam(leagueId, { name: name.trim() }); setName(''); setMessage('팀을 생성했습니다.'); await load(leagueId) } catch (addError) { setError(addError.message) }
  }

  async function rename(team) {
    const nextName = window.prompt('새 팀 이름', team.name)
    if (nextName === null) return
    try { await updateAdminTeam(leagueId, team.id, { name: nextName }); setMessage('팀 이름을 수정했습니다.'); await load(leagueId) } catch (renameError) { setError(renameError.message) }
  }

  async function remove(team) {
    if (!window.confirm(`${team.name}을(를) 삭제할까요?`)) return
    try { await deleteAdminTeam(leagueId, team.id); setMessage('팀을 삭제했습니다.'); await load(leagueId) } catch (removeError) { setError(removeError.message) }
  }

  async function save() {
    setSaving(true)
    try {
      await updateTeamAssignments(leagueId, members.map(member => ({ memberId: Number(member.memberId), teamId: member.teamId ? Number(member.teamId) : null })))
      setMessage('팀 배정을 저장했습니다.')
      await load(leagueId)
    } catch (saveError) { setError(saveError.message) } finally { setSaving(false) }
  }

  async function changeCaptain(team, value) {
    try { await updateTeamCaptain(leagueId, team.id, value ? Number(value) : null); setMessage('주장을 저장했습니다.'); await load(leagueId) } catch (saveError) { setError(saveError.message) }
  }

  return <>
    <PageTitle eyebrow="ADMIN · TEAMS" title="팀 관리" description="리그별 팀을 만들고 참가자를 배정하세요." back />
    {error && <ErrorMessage text={error} />}
    {leagues === null ? <Loading /> : leagues.length === 0 ? <EmptyState text="먼저 리그를 생성해주세요." /> : <>
      <select className="league-select" value={leagueId} onChange={event => changeLeague(event.target.value)}>{leagues.map(league => <option key={league.id} value={league.id}>{league.name}</option>)}</select>
      <div className="team-add card"><input value={name} onChange={event => setName(event.target.value)} placeholder="팀 이름" /><button className="primary" onClick={add}>팀 추가</button></div>
      {teams === null ? <Loading /> : teams.length === 0 ? <EmptyState text="등록된 팀이 없습니다." /> : <div className="team-grid">{teams.map(team => <div className="card team-card" key={team.id}><div className="team-card-heading"><h3>{team.name} <small>{team.memberCount}명</small></h3><label className="captain-field"><span>👑 주장</span><select value={team.captainMemberId || ''} onChange={event => changeCaptain(team, event.target.value)} aria-label={`${team.name} 주장`}><option value="">미지정</option>{team.members.map(member => <option key={member.leagueMemberId} value={member.leagueMemberId}>{member.name}</option>)}</select></label></div><p className="muted">{team.members.map(member => member.name).join(' · ') || '배정된 참가자 없음'}</p><button className="secondary small-button" onClick={() => rename(team)}>이름 수정</button> <button className="secondary small-button" onClick={() => remove(team)}>삭제</button></div>)}</div>}
      <h2 className="section-title">참가자 팀 배정</h2>
      {members && (members.length === 0 ? <EmptyState text="배정할 참가자가 없습니다." /> : <div className="card participant-list">{members.map(member => <label className="participant-row participant-assignment-row" key={member.memberId}><span><b>{member.name}</b><small className={member.memberType === 'REGULAR' ? '' : 'participant-guest'}>{member.memberType === 'REGULAR' ? '정회원' : '게스트'}</small></span><select aria-label={`${member.name} 팀`} value={member.teamId || ''} onChange={event => setMembers(current => current.map(item => item.memberId === member.memberId ? { ...item, teamId: event.target.value || null } : item))}><option value="">미배정</option>{(teams || []).map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>)}</div>)}
      <button className="primary full" disabled={saving || !members} onClick={save}>{saving ? '저장 중...' : '팀 배정 저장'}</button>
      {message && <p className="success">{message}</p>}
    </>}
  </>
}

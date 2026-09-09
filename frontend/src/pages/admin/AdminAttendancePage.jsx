import { useEffect, useMemo, useState } from 'react'
import PageTitle from '../../components/PageTitle'
import { EmptyState, ErrorMessage, Loading } from '../../components/Status'
import { getLeagues } from '../../services/leagueApi'
import { getAdminAttendanceDates, getAdminLeagueAttendance, saveAdminLeagueAttendance } from '../../services/gameApi'
import { formatLeagueLabel } from '../../utils/league'

const dateLabel = value => new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })

function prepareAttendance(data) {
  return {
    ...data,
    members: data.members.map(member => ({
      ...member,
      attendanceStatus: member.attendanceStatus || 'ABSENT',
      actualTeamId: member.attendanceStatus === 'PRESENT' ? member.actualTeamId : null,
    })),
  }
}

export default function AdminAttendancePage() {
  const [leagues, setLeagues] = useState(null)
  const [leagueId, setLeagueId] = useState('')
  const [dates, setDates] = useState(null)
  const [attendanceDate, setAttendanceDate] = useState('')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [invalidMemberIds, setInvalidMemberIds] = useState([])

  useEffect(() => {
    getLeagues().then(items => {
      setLeagues(items)
      if (items[0]) setLeagueId(String(items[0].id))
    }).catch(e => setError(e.message))
  }, [])

  useEffect(() => {
    if (!leagueId) return
    setDates(null)
    setAttendanceDate('')
    setData(null)
    getAdminAttendanceDates(leagueId).then(items => {
      setDates(items)
      if (items[0]) setAttendanceDate(items[0].attendanceDate)
    }).catch(e => {
      setDates([])
      setError(e.message)
    })
  }, [leagueId])

  useEffect(() => {
    if (!attendanceDate) return
    setData(null)
    setError('')
    setMessage('')
    setInvalidMemberIds([])
    getAdminLeagueAttendance(leagueId, attendanceDate).then(result => setData(prepareAttendance(result))).catch(e => setError(e.message))
  }, [leagueId, attendanceDate])

  const presentCount = useMemo(() => data?.members.filter(member => member.attendanceStatus === 'PRESENT').length || 0, [data])

  function toggleAttendance(leagueMemberId) {
    setInvalidMemberIds(current => current.filter(id => id !== leagueMemberId))
    setData(current => ({
      ...current,
      members: current.members.map(member => {
        if (member.leagueMemberId !== leagueMemberId) return member
        const isPresent = member.attendanceStatus === 'PRESENT'
        return {
          ...member,
          attendanceStatus: isPresent ? 'ABSENT' : 'PRESENT',
          actualTeamId: isPresent ? null : member.teamId,
        }
      }),
    }))
  }

  function updateActualTeam(leagueMemberId, value) {
    setInvalidMemberIds(current => current.filter(id => id !== leagueMemberId))
    setData(current => ({
      ...current,
      members: current.members.map(member => member.leagueMemberId === leagueMemberId
        ? { ...member, actualTeamId: value ? Number(value) : null }
        : member),
    }))
  }

  function setAll(status) {
    setInvalidMemberIds([])
    setData(current => ({
      ...current,
      members: current.members.map(member => ({
        ...member,
        attendanceStatus: status,
        actualTeamId: status === 'PRESENT' ? (member.actualTeamId || member.teamId) : null,
      })),
    }))
  }

  async function save() {
    const invalidMembers = data.members.filter(member => member.attendanceStatus === 'PRESENT' && !member.actualTeamId)
    if (invalidMembers.length) {
      setInvalidMemberIds(invalidMembers.map(member => member.leagueMemberId))
      setMessage('')
      setError(invalidMembers.length === 1
        ? `${invalidMembers[0].name}님의 출전팀을 선택해주세요.`
        : `${invalidMembers[0].name}님 외 ${invalidMembers.length - 1}명의 출전팀을 선택해주세요.`)
      return
    }

    setSaving(true)
    setMessage('')
    setError('')
    try {
      await saveAdminLeagueAttendance(leagueId, attendanceDate, data.members.map(member => ({
        leagueMemberId: Number(member.leagueMemberId),
        status: member.attendanceStatus,
        actualTeamId: member.attendanceStatus === 'PRESENT' ? Number(member.actualTeamId) : null,
      })))
      setMessage('출석 정보가 저장되었습니다.')
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return <>
    <PageTitle eyebrow="ADMIN · ATTENDANCE" title="출석 관리" description="리그별 경기일 출석을 관리하세요." back />
    {error && <ErrorMessage text={error} />}
    {leagues === null ? <Loading /> : leagues.length === 0 ? <EmptyState text="먼저 리그를 생성해주세요." /> : <>
      <label className="select-label" htmlFor="attendance-league">리그</label>
      <select id="attendance-league" className="league-select" value={leagueId} onChange={e => setLeagueId(e.target.value)}>
        {leagues.map(league => <option key={league.id} value={league.id}>{formatLeagueLabel(league)}</option>)}
      </select>
      {dates === null ? <Loading /> : dates.length === 0 ? <EmptyState text="날짜가 등록된 경기가 없습니다." /> : <>
        <label className="select-label" htmlFor="attendance-date">경기 날짜</label>
        <select id="attendance-date" className="league-select" value={attendanceDate} onChange={e => setAttendanceDate(e.target.value)}>
          {dates.map(item => <option key={item.attendanceDate} value={item.attendanceDate}>{dateLabel(item.attendanceDate)}</option>)}
        </select>
      </>}
      {data && <>
        <section className="attendance-games card">
          <small>{dateLabel(data.attendanceDate)} 경기</small>
          <p>{data.games.map(game => `${game.homeTeamName} vs ${game.awayTeamName}`).join(' · ')}</p>
        </section>
        <div className="attendance-toolbar">
          <div className="attendance-summary">
            <strong>{dateLabel(data.attendanceDate)} 참가자</strong>
            <span className="attendance-count">참석 {presentCount} / {data.members.length}</span>
          </div>
          <div>
            <button className="secondary small-button" type="button" onClick={() => setAll('PRESENT')}>전체 참석</button>
            <button className="secondary small-button" type="button" onClick={() => setAll('ABSENT')}>전체 불참</button>
          </div>
        </div>
        <p className="attendance-guide">참석 여부와 당일 출전팀을 선택하세요.</p>
        <div className="card attendance-list">
          {data.members.map(member => {
            const isPresent = member.attendanceStatus === 'PRESENT'
            const isInvalid = invalidMemberIds.includes(member.leagueMemberId)
            return <div className={`attendance-row${isPresent ? ' attendance-row-present' : ''}${isInvalid ? ' attendance-row-invalid' : ''}`} key={member.leagueMemberId}>
              <label className="attendance-check">
                <input type="checkbox" checked={isPresent} onChange={() => toggleAttendance(member.leagueMemberId)} />
                <span>
                  <b>{member.name}</b>
                  <small className={member.membershipType === 'REGULAR' ? '' : 'guest-text'}>{member.membershipType === 'REGULAR' ? '정회원' : '게스트'}</small>
                </span>
              </label>
              <div className="attendance-team-field">
                <label className="sr-only" htmlFor={`actual-team-${member.leagueMemberId}`}>{member.name} 출전팀</label>
                <select id={`actual-team-${member.leagueMemberId}`} value={member.actualTeamId || ''} disabled={!isPresent} aria-invalid={isInvalid} onChange={e => updateActualTeam(member.leagueMemberId, e.target.value)}>
                  <option value="">미배정</option>
                  {data.teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
                </select>
                {isInvalid && <small>팀을 선택해주세요.</small>}
              </div>
            </div>
          })}
        </div>
        <div className="attendance-save-bar">
          <span>참석 {presentCount} / {data.members.length}</span>
          <button className="primary" type="button" disabled={saving} onClick={save}>{saving ? '저장 중...' : '저장'}</button>
        </div>
        {message && <p className="success">{message}</p>}
      </>}
    </>}
  </>
}

import { useEffect, useState } from 'react'
import PageTitle from '../../components/PageTitle'
import { EmptyState, ErrorMessage, Loading } from '../../components/Status'
import { getLeagues } from '../../services/leagueApi'
import { getAdminLeagueGames } from '../../services/gameApi'
import { getAdminGameAttendance, saveAdminGameAttendance } from '../../services/gameApi'

const dateLabel = value => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }) : '날짜 미정'
const gameLabel = game => `${game.gameNo}경기 · ${dateLabel(game.gameDate)} · ${game.homeTeamName} vs ${game.awayTeamName}`

export default function AdminAttendancePage() {
  const [leagues, setLeagues] = useState(null); const [leagueId, setLeagueId] = useState(''); const [games, setGames] = useState(null); const [gameId, setGameId] = useState(''); const [data, setData] = useState(null); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [saving, setSaving] = useState(false)
  useEffect(() => { getLeagues().then(items => { setLeagues(items); if (items[0]) setLeagueId(String(items[0].id)) }).catch(e => setError(e.message)) }, [])
  useEffect(() => { if (!leagueId) return; setGames(null); setGameId(''); setData(null); getAdminLeagueGames(leagueId).then(items => { setGames(items); if (items[0]) setGameId(String(items[0].gameId)) }).catch(e => { setGames([]); setError(e.message) }) }, [leagueId])
  useEffect(() => { if (!gameId) return; setData(null); setError(''); getAdminGameAttendance(gameId).then(setData).catch(e => setError(e.message)) }, [gameId])
  const updateStatus = (id, status) => setData(current => ({ ...current, members: current.members.map(member => member.leagueMemberId === id ? { ...member, attendanceStatus: status } : member) }))
  const setAll = status => setData(current => ({ ...current, members: current.members.map(member => ({ ...member, attendanceStatus: status })) }))
  async function save() { setSaving(true); setMessage(''); setError(''); try { await saveAdminGameAttendance(gameId, data.members.map(member => ({ leagueMemberId: Number(member.leagueMemberId), status: member.attendanceStatus }))); setMessage('출석 정보가 저장되었습니다.') } catch (e) { setError(e.message) } finally { setSaving(false) } }
  return <><PageTitle eyebrow="ADMIN · ATTENDANCE" title="출석 관리" description="리그별 경기 출석을 관리하세요." back />
    {error && <ErrorMessage text={error} />}
    {leagues === null ? <Loading /> : leagues.length === 0 ? <EmptyState text="먼저 리그를 생성해주세요." /> : <>
      <label className="select-label" htmlFor="attendance-league">리그</label><select id="attendance-league" className="league-select" value={leagueId} onChange={e => setLeagueId(e.target.value)}>{leagues.map(league => <option key={league.id} value={league.id}>{league.name}</option>)}</select>
      {games === null ? <Loading /> : games.length === 0 ? <EmptyState text="등록된 경기가 없습니다." /> : <><label className="select-label" htmlFor="attendance-game">경기</label><select id="attendance-game" className="league-select" value={gameId} onChange={e => setGameId(e.target.value)}>{games.map(game => <option key={game.gameId} value={game.gameId}>{gameLabel(game)}</option>)}</select></>}
      {data && <><div className="attendance-toolbar"><strong>{data.game.gameNo}경기 참가자</strong><div><button className="secondary small-button" type="button" onClick={() => setAll('PRESENT')}>전체 참석</button><button className="secondary small-button" type="button" onClick={() => setAll('ABSENT')}>전체 불참</button></div></div><div className="card attendance-list">{data.members.map(member => <div className="attendance-row" key={member.leagueMemberId}><div><b>{member.name}</b><small>{member.membershipType === 'REGULAR' ? '정회원' : '게스트'} · {member.teamName || '팀 미배정'}</small></div><div className="attendance-toggle"><button type="button" className={member.attendanceStatus === 'PRESENT' ? 'selected-present' : ''} onClick={() => updateStatus(member.leagueMemberId, 'PRESENT')}>참석</button><button type="button" className={member.attendanceStatus === 'ABSENT' ? 'selected-absent' : ''} onClick={() => updateStatus(member.leagueMemberId, 'ABSENT')}>불참</button></div></div>)}</div><button className="primary full" type="button" disabled={saving || data.members.some(member => !member.attendanceStatus)} onClick={save}>{saving ? '저장 중...' : '출석 저장'}</button>{data.members.some(member => !member.attendanceStatus) && <p className="muted attendance-hint">모든 참가자의 참석 여부를 선택해주세요.</p>}{message && <p className="success">{message}</p>}</>}
    </>}
  </>
}

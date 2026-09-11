import { useEffect, useState } from 'react'
import PageTitle from '../../components/PageTitle'
import { ErrorMessage, Loading } from '../../components/Status'
import { getLeagues } from '../../services/leagueApi'
import { getAdminLeagueTeams } from '../../services/teamApi'
import { createAdminGameSet, deleteAdminGame, getAdminLeagueGames, updateAdminGame, getAdminPlayerScores, saveAdminPlayerScores } from '../../services/gameApi'

const blank = { homeTeamId: '', awayTeamId: '', gameDate: '', status: 'SCHEDULED', homeScore: '', awayScore: '', resultType: 'NORMAL', winnerTeamId: '' }
const blankSet = { gameDate: '', status: 'SCHEDULED' }
const resultTypeLabels = { NORMAL: '정상 경기', TIEBREAK: '동점 후 승부결정', FORFEIT: '몰수 경기' }
const normalizedGameDate = value => String(value || '').slice(0, 10)
const gameDate = value => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }) : '일시 미정'
const displayGameDate = game => gameDate(game.gameDate)
const valuesFromScores = data => Object.fromEntries(data.teams.flatMap(team => team.players.filter(player => player.hasScore).map(player => [player.leagueMemberId, player.points])))
const selectedTeamName = (teams, teamId) => teams.find(team => String(team.id) === String(teamId))?.name || '팀 미정'

function ResultPreview({ form, teams }) {
  if (form.status !== 'COMPLETED') return null
  const hasScores = form.homeScore !== '' && form.awayScore !== ''
  if (form.resultType === 'FORFEIT') return <div className="result-preview"><small>결과 · 승리팀</small><strong>몰수 경기 · {form.winnerTeamId ? `🏆 ${selectedTeamName(teams, form.winnerTeamId)}` : '승리팀을 선택해주세요.'}</strong></div>
  if (form.resultType === 'TIEBREAK') return <div className="result-preview"><small>승리팀</small><strong>{form.winnerTeamId ? `🏆 ${selectedTeamName(teams, form.winnerTeamId)}` : '승리팀을 선택해주세요.'}</strong></div>
  if (!hasScores) return null
  const homeScore = Number(form.homeScore)
  const awayScore = Number(form.awayScore)
  const winner = homeScore === awayScore ? '동점' : `🏆 ${selectedTeamName(teams, homeScore > awayScore ? form.homeTeamId : form.awayTeamId)} 승리`
  return <div className="result-preview"><small>예상 결과</small><strong>{winner}</strong><span>{homeScore} : {awayScore}</span></div>
}

function DifferenceStatus({ total, gameScore, required }) {
  if (!required) return <span className="score-check neutral">합계 일치 필수 아님</span>
  const difference = total - Number(gameScore)
  if (difference === 0) return <span className="score-check matched">일치</span>
  return <span className="score-check mismatched">{Math.abs(difference)}점 {difference > 0 ? '초과' : '부족'}</span>
}

export default function AdminGamesPage() {
  const [leagues, setLeagues] = useState([])
  const [leagueId, setLeagueId] = useState('')
  const [teams, setTeams] = useState([])
  const [games, setGames] = useState(null)
  const [form, setForm] = useState(blank)
  const [scheduleForm, setScheduleForm] = useState(blankSet)
  const [editing, setEditing] = useState(null)
  const [scoresGame, setScoresGame] = useState(null)
  const [scoreValues, setScoreValues] = useState({})
  const [savingScores, setSavingScores] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function load(selectedLeagueId = leagueId) {
    try {
      const [gameData, teamData] = await Promise.all([getAdminLeagueGames(selectedLeagueId), getAdminLeagueTeams(selectedLeagueId)])
      setGames(gameData)
      setTeams(teamData)
    } catch (loadError) { setError(loadError.message) }
  }

  useEffect(() => {
    getLeagues().then(data => { setLeagues(data); if (data[0]) { const selected = String(data[0].id); setLeagueId(selected); load(selected) } else setGames([]) }).catch(loadError => { setError(loadError.message); setGames([]) })
  }, [])

  const change = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const changeLeague = value => { setGames(null); setLeagueId(value); setScoresGame(null); load(value) }
  const edit = game => {
    setEditing(game.gameId)
    // game_date는 PostgreSQL DATE이므로 시간대 변환 없이 YYYY-MM-DD로 사용한다.
    setForm({ homeTeamId: String(game.homeTeamId), awayTeamId: String(game.awayTeamId), gameDate: normalizedGameDate(game.gameDate), status: game.status, homeScore: game.homeScore ?? '', awayScore: game.awayScore ?? '', resultType: game.resultType || 'NORMAL', winnerTeamId: game.winnerTeamId ? String(game.winnerTeamId) : '' })
  }
  const reset = () => { setEditing(null); setForm(blank); setConfirmOpen(false) }

  function save(event) {
    event.preventDefault()
    setError('')
    if (form.status === 'COMPLETED' && form.resultType === 'FORFEIT' && !form.winnerTeamId) { setError('몰수 경기의 승리팀을 선택해주세요.'); return }
    if (form.status === 'COMPLETED' && form.resultType === 'TIEBREAK' && !form.winnerTeamId) { setError('동점 후 승부결정 경기의 승리팀을 선택해주세요.'); return }
    setConfirmOpen(true)
  }

  async function confirmSave() {
    setConfirmOpen(false)
    const data = { ...form, homeTeamId: Number(form.homeTeamId), awayTeamId: Number(form.awayTeamId), homeScore: form.status === 'COMPLETED' ? Number(form.homeScore) : null, awayScore: form.status === 'COMPLETED' ? Number(form.awayScore) : null, winnerTeamId: form.winnerTeamId ? Number(form.winnerTeamId) : null }
    try {
      await updateAdminGame(leagueId, editing, data)
      setMessage('경기를 수정했습니다.')
      reset()
      load()
    } catch (saveError) { setError(saveError.message) }
  }

  async function createSet(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    try {
      await createAdminGameSet(leagueId, scheduleForm)
      setMessage('3경기 세트를 추가했습니다.')
      setScheduleForm(blankSet)
      load()
    } catch (saveError) { setError(saveError.message) }
  }

  async function remove(game) {
    if (!window.confirm('이 경기를 삭제할까요?')) return
    try { await deleteAdminGame(leagueId, game.gameId); setMessage('경기를 삭제했습니다.'); load() } catch (removeError) { setError(removeError.message) }
  }

  async function openScores(game) {
    setError('')
    setMessage('')
    try {
      const data = await getAdminPlayerScores(game.gameId)
      setScoresGame(data)
      setScoreValues(valuesFromScores(data))
    } catch (loadError) { setError(loadError.message) }
  }

  async function saveScores() {
    setSavingScores(true)
    setError('')
    setMessage('')
    try {
      const scores = Object.entries(scoreValues)
        .filter(([, value]) => value !== '' && Number(value) > 0)
        .map(([leagueMemberId, points]) => ({ leagueMemberId: Number(leagueMemberId), points: Number(points) }))
      const saved = await saveAdminPlayerScores(scoresGame.gameId, scores)
      setScoresGame(saved)
      setScoreValues(valuesFromScores(saved))
      setMessage('개인 득점을 저장했습니다.')
    } catch (saveError) {
      setError(saveError.status === 409 ? '완료된 경기만 개인 득점을 입력할 수 있습니다.' : saveError.message)
    } finally { setSavingScores(false) }
  }

  const scoreTotal = team => team.players.reduce((sum, player) => sum + Number(scoreValues[player.leagueMemberId] || 0), 0)

  return <>
    <PageTitle eyebrow="ADMIN · GAMES" title="경기 관리" description="리그별 대진과 경기 결과를 관리하세요." back />
    {error && <ErrorMessage text={error} />}
    <select className="league-select" value={leagueId} onChange={event => changeLeague(event.target.value)}>{leagues.map(league => <option key={league.id} value={league.id}>{league.name}</option>)}</select>

    {!editing && <form className="card form game-form" onSubmit={createSet}>
      <h3>3경기 세트 추가</h3>
      <label className="game-date-field">경기 날짜<input type="date" value={scheduleForm.gameDate} onChange={event => setScheduleForm(current => ({ ...current, gameDate: event.target.value }))} required /></label>
      <label className="game-status-field">상태<select value={scheduleForm.status} onChange={event => setScheduleForm(current => ({ ...current, status: event.target.value }))}><option value="SCHEDULED">예정</option></select></label>
      <button className="primary game-submit" disabled={!teams.length}>3경기 추가</button>
    </form>}

    {editing && <form className="card form game-form" onSubmit={save}>
      <h3>경기 수정</h3>
      <label>팀 1<select value={form.homeTeamId} onChange={event => change('homeTeamId', event.target.value)} required><option value="">선택</option>{teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
      <label>팀 2<select value={form.awayTeamId} onChange={event => change('awayTeamId', event.target.value)} required><option value="">선택</option>{teams.filter(team => String(team.id) !== String(form.homeTeamId)).map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
      <label className="game-date-field">경기 날짜<input type="date" value={form.gameDate} onChange={event => change('gameDate', event.target.value)} required /></label>
      <label className="game-status-field">상태<select value={form.status} onChange={event => change('status', event.target.value)}><option value="SCHEDULED">예정</option><option value="COMPLETED">종료</option></select></label>
      {form.status === 'COMPLETED' && <>
        <div className="score-fields"><label>팀 1 점수<input type="number" min="0" step="1" value={form.homeScore} onChange={event => change('homeScore', event.target.value)} required /></label><label>팀 2 점수<input type="number" min="0" step="1" value={form.awayScore} onChange={event => change('awayScore', event.target.value)} required /></label></div>
        <label className="result-type-field">결과 유형<select value={form.resultType} onChange={event => change('resultType', event.target.value)}><option value="NORMAL">정상 경기</option><option value="TIEBREAK">동점 후 승부결정</option><option value="FORFEIT">몰수 경기</option></select></label>
        {(form.resultType === 'FORFEIT' || form.resultType === 'TIEBREAK') && <label className="winner-field">승리팀<select value={form.winnerTeamId} onChange={event => change('winnerTeamId', event.target.value)} required><option value="">선택</option><option value={form.homeTeamId}>{selectedTeamName(teams, form.homeTeamId)}</option><option value={form.awayTeamId}>{selectedTeamName(teams, form.awayTeamId)}</option></select></label>}
        <ResultPreview form={form} teams={teams} />
      </>}
      <div className="game-actions"><button type="button" className="secondary" onClick={reset}>취소</button><button className="primary" disabled={!teams.length}>수정 저장</button></div>
    </form>
    }

    {confirmOpen && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setConfirmOpen(false) }}><div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <h3 id="confirm-title">경기 결과를 저장하시겠습니까?</h3>
      <p className="confirm-score">{selectedTeamName(teams, form.homeTeamId)} {form.homeScore} : {form.awayScore} {selectedTeamName(teams, form.awayTeamId)}</p>
      <p className="confirm-result">{form.resultType === 'FORFEIT' ? '결과: 몰수 경기' : form.resultType === 'TIEBREAK' ? '결과: 동점 후 승부결정' : '결과: 정상 경기'}<br />승리팀: {form.resultType === 'NORMAL' ? (form.homeScore === form.awayScore ? '동점' : selectedTeamName(teams, Number(form.homeScore) > Number(form.awayScore) ? form.homeTeamId : form.awayTeamId)) : selectedTeamName(teams, form.winnerTeamId)}</p>
      <div className="modal-actions"><button type="button" className="secondary" onClick={() => setConfirmOpen(false)}>취소</button><button type="button" className="primary" onClick={confirmSave}>저장</button></div>
    </div></div>}

    {message && <p className="success">{message}</p>}
    {scoresGame && <section className="card player-score-editor">
      <div className="player-score-header">
        <div><small>{gameDate(scoresGame.gameDate)} · {scoresGame.gameNo}경기</small><h3>개인 득점 관리</h3></div>
        <button className="score-close" type="button" aria-label="닫기" onClick={() => setScoresGame(null)}>×</button>
      </div>
      <div className="final-score"><strong>{scoresGame.teams[0].teamName}</strong><b>{scoresGame.teams[0].gameScore} : {scoresGame.teams[1].gameScore}</b><strong>{scoresGame.teams[1].teamName}</strong></div>
      <div className="score-type"><span>{resultTypeLabels[scoresGame.resultType] || scoresGame.resultType}</span>{scoresGame.resultType === 'FORFEIT' && <em>개인 합계 일치 필수 아님</em>}</div>
      <div className="player-score-teams">{scoresGame.teams.map(team => {
        const total = scoreTotal(team)
        return <div className="player-score-team" key={team.teamId}>
          <div className="player-score-summary"><h4>{team.teamName}</h4><p><b>{total}</b> / {team.gameScore}점 <DifferenceStatus total={total} gameScore={team.gameScore} required={team.consistencyRequired} /></p></div>
          {team.players.length === 0 ? <p className="muted">배정된 선수가 없습니다.</p> : team.players.map(player => <label className="player-score-row" key={player.leagueMemberId}><span>{player.name}</span><input type="number" inputMode="numeric" min="0" step="1" placeholder="0" value={scoreValues[player.leagueMemberId] ?? ''} onChange={event => setScoreValues(values => ({ ...values, [player.leagueMemberId]: event.target.value }))} /><i>점</i></label>)}
        </div>
      })}</div>
      <button className="primary full" type="button" disabled={savingScores} onClick={saveScores}>{savingScores ? '저장 중...' : '개인 득점 저장'}</button>
    </section>}

    {games === null ? <Loading /> : games.length === 0 ? <div className="empty card"><h3>등록된 경기가 없습니다.</h3></div> : <div className="game-list">{games.map(game => <article className="card game-card" key={game.gameId}><div className="game-card-head"><b>{game.gameNo}경기</b><span>{game.status === 'COMPLETED' ? '경기 종료' : '경기 예정'}</span><small>{displayGameDate(game)}</small></div><h3>{game.homeTeamName} {game.status === 'COMPLETED' ? `${game.homeScore} : ${game.awayScore}` : 'vs'} {game.awayTeamName}</h3>{game.status === 'COMPLETED' && <button className="secondary small-button" onClick={() => openScores(game)}>개인 득점</button>} <button className="secondary small-button" onClick={() => edit(game)}>수정</button> <button className="secondary small-button" onClick={() => remove(game)}>삭제</button></article>)}</div>}
  </>
}

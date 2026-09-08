import { useEffect, useState } from 'react'
import PageTitle from '../../components/PageTitle'
import { ErrorMessage, Loading } from '../../components/Status'
import { getLeagues } from '../../services/leagueApi'
import { getAdminLeagueTeams } from '../../services/teamApi'
import { createAdminGame, deleteAdminGame, getAdminLeagueGames, updateAdminGame, getAdminPlayerScores, saveAdminPlayerScores } from '../../services/gameApi'

const blank = { homeTeamId: '', awayTeamId: '', scheduledAt: '', status: 'SCHEDULED', homeScore: '', awayScore: '' }
const resultTypeLabels = { NORMAL: '정상 경기', TIEBREAK: '동점 후 승부결정', FORFEIT: '몰수 경기' }
const localDate = value => value ? new Date(value).toISOString().slice(0, 16) : ''
const gameDate = value => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('ko-KR') : '날짜 미정'
const valuesFromScores = data => Object.fromEntries(data.teams.flatMap(team => team.players.filter(player => player.hasScore).map(player => [player.leagueMemberId, player.points])))

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
  const [editing, setEditing] = useState(null)
  const [scoresGame, setScoresGame] = useState(null)
  const [scoreValues, setScoreValues] = useState({})
  const [savingScores, setSavingScores] = useState(false)
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
    setForm({ homeTeamId: String(game.homeTeamId), awayTeamId: String(game.awayTeamId), scheduledAt: localDate(game.scheduledAt), status: game.status, homeScore: game.homeScore ?? '', awayScore: game.awayScore ?? '' })
  }
  const reset = () => { setEditing(null); setForm(blank) }

  async function save(event) {
    event.preventDefault()
    setError('')
    const data = { ...form, homeTeamId: Number(form.homeTeamId), awayTeamId: Number(form.awayTeamId), scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null, homeScore: form.status === 'COMPLETED' ? Number(form.homeScore) : null, awayScore: form.status === 'COMPLETED' ? Number(form.awayScore) : null }
    try {
      if (editing) await updateAdminGame(leagueId, editing, data)
      else await createAdminGame(leagueId, data)
      setMessage(editing ? '경기를 수정했습니다.' : '경기를 추가했습니다.')
      reset()
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

    <form className="card form" onSubmit={save}>
      <h3>{editing ? '경기 수정' : '경기 추가'}</h3>
      <label>홈팀<select value={form.homeTeamId} onChange={event => change('homeTeamId', event.target.value)} required><option value="">선택</option>{teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
      <label>원정팀<select value={form.awayTeamId} onChange={event => change('awayTeamId', event.target.value)} required><option value="">선택</option>{teams.filter(team => String(team.id) !== String(form.homeTeamId)).map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
      <label>경기 일시<input type="datetime-local" value={form.scheduledAt} onChange={event => change('scheduledAt', event.target.value)} /></label>
      <label>상태<select value={form.status} onChange={event => change('status', event.target.value)}><option value="SCHEDULED">예정</option><option value="COMPLETED">종료</option></select></label>
      {form.status === 'COMPLETED' && <div className="score-fields"><label>홈팀 점수<input type="number" min="0" value={form.homeScore} onChange={event => change('homeScore', event.target.value)} required /></label><label>원정팀 점수<input type="number" min="0" value={form.awayScore} onChange={event => change('awayScore', event.target.value)} required /></label></div>}
      <button className="primary" disabled={!teams.length}>{editing ? '수정 저장' : '경기 추가'}</button>
      {editing && <button type="button" className="secondary" onClick={reset}>취소</button>}
    </form>

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

    {games === null ? <Loading /> : games.length === 0 ? <div className="empty card"><h3>등록된 경기가 없습니다.</h3></div> : <div className="game-list">{games.map(game => <article className="card game-card" key={game.gameId}><div className="game-card-head"><span>{game.status === 'COMPLETED' ? '경기 종료' : '경기 예정'}</span><small>{game.scheduledAt ? new Date(game.scheduledAt).toLocaleString('ko-KR') : '일시 미정'}</small></div><h3>{game.homeTeamName} {game.status === 'COMPLETED' ? `${game.homeScore} : ${game.awayScore}` : 'vs'} {game.awayTeamName}</h3>{game.status === 'COMPLETED' && <button className="secondary small-button" onClick={() => openScores(game)}>개인 득점</button>} <button className="secondary small-button" onClick={() => edit(game)}>수정</button> <button className="secondary small-button" onClick={() => remove(game)}>삭제</button></article>)}</div>}
  </>
}

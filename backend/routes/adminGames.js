const express = require('express');
const pool = require('../db');
const router = express.Router({ mergeParams: true });

function id(value) { return /^\d+$/.test(String(value)) && Number(value) > 0 ? Number(value) : null; }
function score(value) { if (value === null || value === undefined || value === '') return null; return Number.isSafeInteger(value) && value >= 0 ? value : undefined; }
function validate(input) {
  if (!input.leagueId || !input.homeTeamId || !input.awayTeamId) return '리그와 양 팀은 필수입니다.';
  if (input.homeTeamId === input.awayTeamId) return '홈팀과 원정팀은 달라야 합니다.';
  if (!['SCHEDULED', 'COMPLETED'].includes(input.status)) return '유효하지 않은 경기 상태입니다.';
  if (input.homeScore === undefined || input.awayScore === undefined) return '점수 형식이 올바르지 않습니다.';
  if (input.status === 'COMPLETED' && (input.homeScore === null || input.awayScore === null)) return '종료된 경기는 양 팀 점수가 필요합니다.';
  if (input.status === 'SCHEDULED' && (input.homeScore !== null || input.awayScore !== null)) return '예정 경기에는 점수를 입력할 수 없습니다.';
  return null;
}
const fields = `g.id AS "gameId", gd.league_id AS "leagueId", gd.game_date AS "gameDate", g.game_no AS "gameNo", g.scheduled_at AS "scheduledAt", g.status, g.team_a_id AS "homeTeamId", home.name AS "homeTeamName", g.team_b_id AS "awayTeamId", away.name AS "awayTeamName", g.team_a_score AS "homeScore", g.team_b_score AS "awayScore", g.created_at AS "createdAt", g.updated_at AS "updatedAt"`;
const joins = 'FROM game g JOIN game_day gd ON gd.id = g.game_day_id JOIN team home ON home.id = g.team_a_id JOIN team away ON away.id = g.team_b_id';

async function teamsBelong(client, leagueId, homeTeamId, awayTeamId) {
  const result = await client.query('SELECT COUNT(*)::int AS count FROM team WHERE league_id = $1 AND id = ANY($2::bigint[])', [leagueId, [homeTeamId, awayTeamId]]);
  return result.rows[0].count === 2;
}

router.get('/', async (req, res) => {
  const leagueId = id(req.params.leagueId);
  if (!leagueId) return res.status(400).json({ message: 'Invalid league id' });
  try { const result = await pool.query(`SELECT ${fields} ${joins} WHERE gd.league_id = $1 ORDER BY g.scheduled_at NULLS LAST, gd.game_date, g.game_no, g.id`, [leagueId]); res.json(result.rows); } catch (error) { console.error(error); res.status(500).json({ message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }); }
});

router.post('/', async (req, res) => {
  const leagueId = id(req.params.leagueId); const homeTeamId = id(req.body?.homeTeamId); const awayTeamId = id(req.body?.awayTeamId); const status = req.body?.status || 'SCHEDULED'; const homeScore = score(req.body?.homeScore); const awayScore = score(req.body?.awayScore); const errorMessage = validate({ leagueId, homeTeamId, awayTeamId, status, homeScore, awayScore });
  if (errorMessage) return res.status(400).json({ message: errorMessage });
  const scheduledAt = req.body?.scheduledAt || null; const date = scheduledAt ? new Date(scheduledAt) : new Date();
  if (Number.isNaN(date.getTime())) return res.status(400).json({ message: '경기 일시 형식이 올바르지 않습니다.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (!(await client.query('SELECT 1 FROM league WHERE id = $1', [leagueId])).rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'League not found' }); }
    if (!(await teamsBelong(client, leagueId, homeTeamId, awayTeamId))) { await client.query('ROLLBACK'); return res.status(400).json({ message: '양 팀은 해당 리그에 속해야 합니다.' }); }
    const day = await client.query('INSERT INTO game_day (league_id, game_date) VALUES ($1, $2) ON CONFLICT (league_id, game_date) DO UPDATE SET game_date = EXCLUDED.game_date RETURNING id', [leagueId, date.toISOString().slice(0, 10)]);
    const number = await client.query('SELECT COALESCE(MAX(game_no), 0) + 1 AS next FROM game WHERE game_day_id = $1', [day.rows[0].id]);
    const created = await client.query('INSERT INTO game (game_day_id, game_no, team_a_id, team_b_id, team_a_score, team_b_score, status, scheduled_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id', [day.rows[0].id, number.rows[0].next, homeTeamId, awayTeamId, homeScore, awayScore, status, scheduledAt]);
    await client.query('COMMIT');
    const result = await pool.query(`SELECT ${fields} ${joins} WHERE g.id = $1`, [created.rows[0].id]); res.status(201).json(result.rows[0]);
  } catch (error) { await client.query('ROLLBACK'); console.error(error); res.status(500).json({ message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }); } finally { client.release(); }
});

router.patch('/:gameId', async (req, res) => {
  const leagueId = id(req.params.leagueId); const gameId = id(req.params.gameId); if (!leagueId || !gameId) return res.status(400).json({ message: 'Invalid game id' });
  const current = await pool.query('SELECT g.* FROM game g JOIN game_day gd ON gd.id = g.game_day_id WHERE g.id = $1 AND gd.league_id = $2', [gameId, leagueId]); if (!current.rowCount) return res.status(404).json({ message: 'Game not found' });
  const old = current.rows[0]; const homeTeamId = req.body?.homeTeamId === undefined ? Number(old.team_a_id) : id(req.body.homeTeamId); const awayTeamId = req.body?.awayTeamId === undefined ? Number(old.team_b_id) : id(req.body.awayTeamId); const status = req.body?.status || old.status; const homeScore = req.body?.homeScore === undefined ? old.team_a_score : score(req.body.homeScore); const awayScore = req.body?.awayScore === undefined ? old.team_b_score : score(req.body.awayScore); const errorMessage = validate({ leagueId, homeTeamId, awayTeamId, status, homeScore, awayScore }); if (errorMessage) return res.status(400).json({ message: errorMessage });
  if (!(await teamsBelong(pool, leagueId, homeTeamId, awayTeamId))) return res.status(400).json({ message: '양 팀은 해당 리그에 속해야 합니다.' });
  const scheduledAt = req.body?.scheduledAt === undefined ? old.scheduled_at : (req.body.scheduledAt || null);
  try { await pool.query('UPDATE game SET team_a_id=$1, team_b_id=$2, team_a_score=$3, team_b_score=$4, status=$5, scheduled_at=$6, updated_at=CURRENT_TIMESTAMP WHERE id=$7', [homeTeamId, awayTeamId, homeScore, awayScore, status, scheduledAt, gameId]); const result = await pool.query(`SELECT ${fields} ${joins} WHERE g.id = $1`, [gameId]); res.json(result.rows[0]); } catch (error) { console.error(error); res.status(500).json({ message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }); }
});

router.delete('/:gameId', async (req, res) => { const leagueId = id(req.params.leagueId); const gameId = id(req.params.gameId); if (!leagueId || !gameId) return res.status(400).json({ message: 'Invalid game id' }); try { const result = await pool.query('DELETE FROM game g USING game_day gd WHERE g.game_day_id = gd.id AND g.id = $1 AND gd.league_id = $2', [gameId, leagueId]); if (!result.rowCount) return res.status(404).json({ message: 'Game not found' }); res.status(204).send(); } catch (error) { console.error(error); res.status(500).json({ message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }); } });

module.exports = router;

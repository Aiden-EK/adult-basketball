const express = require('express');
const pool = require('../db');
const router = express.Router({ mergeParams: true });

function parseId(value) { return /^\d+$/.test(String(value)) && Number(value) > 0 ? Number(value) : null; }

async function readScores(db, gameId) {
  const game = await db.query(`SELECT g.id AS "gameId", g.status, g.team_a_id AS "teamAId", a.name AS "teamAName", g.team_b_id AS "teamBId", b.name AS "teamBName", g.team_a_score AS "teamAScore", g.team_b_score AS "teamBScore"
    FROM game g JOIN team a ON a.id=g.team_a_id JOIN team b ON b.id=g.team_b_id WHERE g.id=$1`, [gameId]);
  if (!game.rowCount) return null;
  const row = game.rows[0];
  const members = await db.query(`SELECT lm.id AS "leagueMemberId", m.id AS "memberId", m.name, lm.team_id AS "teamId", COALESCE(s.points, 0) AS points, (s.id IS NOT NULL) AS "hasScore"
    FROM league_member lm JOIN member m ON m.id=lm.member_id LEFT JOIN game_player_score s ON s.league_member_id=lm.id AND s.game_id=$1
    WHERE lm.team_id IN ($2,$3) ORDER BY lm.team_id, m.name, lm.id`, [gameId, row.teamAId, row.teamBId]);
  const teams = [{ teamId: row.teamAId, teamName: row.teamAName, gameScore: row.teamAScore }, { teamId: row.teamBId, teamName: row.teamBName, gameScore: row.teamBScore }].map(team => {
    const players = members.rows.filter(member => Number(member.teamId) === Number(team.teamId));
    const points = players.filter(p => p.hasScore).reduce((sum, p) => sum + Number(p.points), 0);
    return { ...team, players, points, difference: team.gameScore === null ? null : points - Number(team.gameScore), matches: team.gameScore !== null && points === Number(team.gameScore) };
  });
  return { gameId: row.gameId, status: row.status, teams };
}

router.get('/:gameId/player-scores', async (req, res) => {
  const gameId = parseId(req.params.gameId); if (!gameId) return res.status(400).json({ message: 'Invalid game id' });
  try { const result = await readScores(pool, gameId); if (!result) return res.status(404).json({ message: 'Game not found' }); res.json(result); } catch (error) { console.error(error); res.status(500).json({ message: 'Database error' }); }
});

router.put('/:gameId/player-scores', async (req, res) => {
  if (!req.baseUrl.startsWith('/api/admin/')) return res.status(403).json({ message: '관리자만 개인 득점을 수정할 수 있습니다.' });
  const gameId = parseId(req.params.gameId); const scores = req.body?.scores;
  if (!gameId || !Array.isArray(scores)) return res.status(400).json({ message: 'scores must be an array' });
  if (scores.some(score => !Number.isSafeInteger(score.leagueMemberId) || score.leagueMemberId < 1 || !Number.isSafeInteger(score.points) || score.points < 0)) return res.status(400).json({ message: '선수와 득점은 유효한 0 이상의 정수여야 합니다.' });
  if (new Set(scores.map(score => score.leagueMemberId)).size !== scores.length) return res.status(400).json({ message: '같은 선수의 기록을 중복 입력할 수 없습니다.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const game = await client.query(`SELECT g.status, gd.league_id AS "leagueId", g.team_a_id, g.team_b_id FROM game g JOIN game_day gd ON gd.id=g.game_day_id WHERE g.id=$1 FOR UPDATE`, [gameId]);
    if (!game.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Game not found' }); }
    const current = game.rows[0];
    if (current.status !== 'COMPLETED') { await client.query('ROLLBACK'); return res.status(409).json({ message: '예정 경기에는 개인 득점을 입력할 수 없습니다.' }); }
    if (scores.length) {
      const ids = scores.map(score => score.leagueMemberId);
      const valid = await client.query(`SELECT id FROM league_member WHERE id=ANY($1::bigint[]) AND league_id=$2 AND team_id IN ($3,$4)`, [ids, current.leagueId, current.team_a_id, current.team_b_id]);
      if (valid.rowCount !== ids.length) { await client.query('ROLLBACK'); return res.status(400).json({ message: '해당 경기 양 팀에 소속된 리그 참가자만 입력할 수 있습니다.' }); }
    }
    await client.query('DELETE FROM game_player_score WHERE game_id=$1', [gameId]);
    for (const score of scores) await client.query('INSERT INTO game_player_score (game_id, league_member_id, points) VALUES ($1,$2,$3)', [gameId, score.leagueMemberId, score.points]);
    await client.query('COMMIT'); res.json(await readScores(pool, gameId));
  } catch (error) { await client.query('ROLLBACK'); console.error(error); res.status(500).json({ message: 'Database error' }); } finally { client.release(); }
});

module.exports = router;

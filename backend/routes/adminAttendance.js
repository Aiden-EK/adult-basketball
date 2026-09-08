const express = require('express');
const pool = require('../db');

const router = express.Router();
const parseId = value => /^\d+$/.test(String(value)) && Number(value) > 0 ? Number(value) : null;
const gameFields = `g.id AS "id", g.game_no AS "gameNo", gd.league_id AS "leagueId", gd.game_date AS "gameDate", g.status, home.name AS "homeTeamName", away.name AS "awayTeamName"`;

router.get('/:gameId/attendance', async (req, res) => {
  const gameId = parseId(req.params.gameId);
  if (!gameId) return res.status(400).json({ message: 'Invalid game id' });
  try {
    const game = await pool.query(`SELECT ${gameFields} FROM game g JOIN game_day gd ON gd.id=g.game_day_id JOIN team home ON home.id=g.team_a_id JOIN team away ON away.id=g.team_b_id WHERE g.id=$1`, [gameId]);
    if (!game.rowCount) return res.status(404).json({ message: 'Game not found' });
    const members = await pool.query(`SELECT lm.id AS "leagueMemberId", m.id AS "memberId", m.name, m.grade AS "membershipType", lm.team_id AS "teamId", t.name AS "teamName", ga.status AS "attendanceStatus"
      FROM league_member lm JOIN member m ON m.id=lm.member_id LEFT JOIN team t ON t.id=lm.team_id
      LEFT JOIN game_attendance ga ON ga.league_member_id=lm.id AND ga.game_id=$1
      WHERE lm.league_id=$2 ORDER BY m.name, m.id`, [gameId, game.rows[0].leagueId]);
    res.json({ game: game.rows[0], members: members.rows });
  } catch (error) { console.error('Game attendance read failed:', error); res.status(500).json({ message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }); }
});

router.put('/:gameId/attendance', async (req, res) => {
  const gameId = parseId(req.params.gameId); const attendance = req.body?.attendance;
  if (!gameId || !Array.isArray(attendance) || attendance.some(item => !parseId(item?.leagueMemberId) || !['PRESENT', 'ABSENT'].includes(item?.status))) return res.status(400).json({ message: '출석 데이터 형식이 올바르지 않습니다.' });
  if (new Set(attendance.map(item => Number(item.leagueMemberId))).size !== attendance.length) return res.status(400).json({ message: '중복된 참가자가 있습니다.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const game = await client.query('SELECT gd.league_id AS "leagueId" FROM game g JOIN game_day gd ON gd.id=g.game_day_id WHERE g.id=$1', [gameId]);
    if (!game.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Game not found' }); }
    const leagueId = game.rows[0].leagueId;
    for (const item of attendance) {
      const valid = await client.query('SELECT 1 FROM league_member WHERE id=$1 AND league_id=$2', [item.leagueMemberId, leagueId]);
      if (!valid.rowCount) { await client.query('ROLLBACK'); return res.status(400).json({ message: '해당 리그 참가자가 아닌 회원은 저장할 수 없습니다.' }); }
    }
    for (const item of attendance) await client.query(`INSERT INTO game_attendance (game_id, league_member_id, status) VALUES ($1,$2,$3) ON CONFLICT (game_id, league_member_id) DO UPDATE SET status=EXCLUDED.status, updated_at=CURRENT_TIMESTAMP`, [gameId, item.leagueMemberId, item.status]);
    await client.query('COMMIT');
    res.json({ gameId, attendance });
  } catch (error) { await client.query('ROLLBACK'); console.error('Game attendance save failed:', error); res.status(500).json({ message: '출석 정보를 저장하지 못했습니다.' }); } finally { client.release(); }
});

module.exports = router;

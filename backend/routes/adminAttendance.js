const express = require('express');
const pool = require('../db');
const router = express.Router({ mergeParams: true });
const id = value => /^\d+$/.test(String(value)) && Number(value) > 0 ? Number(value) : null;
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value)) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) ? value : null;

async function getGameDay(client, leagueId, attendanceDate) {
  return client.query('SELECT id FROM game_day WHERE league_id=$1 AND game_date=$2', [leagueId, attendanceDate]);
}

router.get('/dates', async (req, res) => {
  const leagueId = id(req.params.leagueId);
  if (!leagueId) return res.status(400).json({ message: 'Invalid league id' });
  try {
    const result = await pool.query(`SELECT gd.game_date AS "attendanceDate", COUNT(g.id)::int AS "gameCount"
      FROM game_day gd JOIN game g ON g.game_day_id=gd.id WHERE gd.league_id=$1
      GROUP BY gd.id, gd.game_date ORDER BY gd.game_date DESC`, [leagueId]);
    res.json(result.rows);
  } catch (error) { console.error('Attendance dates read failed:', error); res.status(500).json({ message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }); }
});

router.get('/', async (req, res) => {
  const leagueId = id(req.params.leagueId); const attendanceDate = date(req.query.date);
  if (!leagueId || !attendanceDate) return res.status(400).json({ message: '유효한 리그와 경기 날짜가 필요합니다.' });
  try {
    const day = await getGameDay(pool, leagueId, attendanceDate);
    if (!day.rowCount) return res.status(404).json({ message: '해당 날짜에 등록된 경기가 없습니다.' });
    const games = await pool.query(`SELECT g.id AS "gameId", g.game_no AS "gameNo", home.name AS "homeTeamName", away.name AS "awayTeamName"
      FROM game g JOIN team home ON home.id=g.team_a_id JOIN team away ON away.id=g.team_b_id WHERE g.game_day_id=$1 ORDER BY g.game_no, g.id`, [day.rows[0].id]);
    const members = await pool.query(`SELECT lm.id AS "leagueMemberId", m.id AS "memberId", m.name, m.grade AS "membershipType", lm.team_id AS "teamId", t.name AS "teamName", a.status AS "attendanceStatus"
      FROM league_member lm JOIN member m ON m.id=lm.member_id LEFT JOIN team t ON t.id=lm.team_id
      LEFT JOIN attendance a ON a.game_day_id=$1 AND a.league_member_id=lm.id
      WHERE lm.league_id=$2 ORDER BY m.name, m.id`, [day.rows[0].id, leagueId]);
    res.json({ leagueId, attendanceDate, games: games.rows, members: members.rows });
  } catch (error) { console.error('Attendance read failed:', error); res.status(500).json({ message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }); }
});

router.put('/:attendanceDate', async (req, res) => {
  const leagueId = id(req.params.leagueId); const attendanceDate = date(req.params.attendanceDate); const attendance = req.body?.attendance;
  if (!leagueId || !attendanceDate || !Array.isArray(attendance) || attendance.some(item => !id(item?.leagueMemberId) || !['PRESENT', 'ABSENT'].includes(item?.status))) return res.status(400).json({ message: '출석 데이터 형식이 올바르지 않습니다.' });
  if (new Set(attendance.map(item => Number(item.leagueMemberId))).size !== attendance.length) return res.status(400).json({ message: '중복된 참가자가 있습니다.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (!(await client.query('SELECT 1 FROM league WHERE id=$1', [leagueId])).rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'League not found' }); }
    const day = await getGameDay(client, leagueId, attendanceDate);
    if (!day.rowCount || !(await client.query('SELECT 1 FROM game WHERE game_day_id=$1 LIMIT 1', [day.rows[0]?.id])).rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ message: '해당 날짜에 등록된 경기가 없습니다.' }); }
    for (const item of attendance) {
      const participant = await client.query('SELECT lm.member_id, lm.team_id, m.grade FROM league_member lm JOIN member m ON m.id=lm.member_id WHERE lm.id=$1 AND lm.league_id=$2', [item.leagueMemberId, leagueId]);
      if (!participant.rowCount) { await client.query('ROLLBACK'); return res.status(400).json({ message: '해당 리그 참가자가 아닌 회원은 저장할 수 없습니다.' }); }
      const row = participant.rows[0];
      await client.query(`INSERT INTO attendance (game_day_id, member_id, league_member_id, actual_team_id, grade_snapshot, status)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (game_day_id, league_member_id) DO UPDATE SET status=EXCLUDED.status, actual_team_id=EXCLUDED.actual_team_id, grade_snapshot=EXCLUDED.grade_snapshot, updated_at=CURRENT_TIMESTAMP`, [day.rows[0].id, row.member_id, item.leagueMemberId, item.status === 'PRESENT' ? row.team_id : null, row.grade, item.status]);
    }
    await client.query('COMMIT'); res.json({ leagueId, attendanceDate, attendance });
  } catch (error) { await client.query('ROLLBACK'); console.error('Attendance save failed:', error); res.status(500).json({ message: '출석 정보를 저장하지 못했습니다.' }); } finally { client.release(); }
});

module.exports = router;

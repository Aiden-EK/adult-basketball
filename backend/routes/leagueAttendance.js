const express = require('express');
const pool = require('../db');

const router = express.Router({ mergeParams: true });
const id = value => /^\d+$/.test(String(value)) && Number(value) > 0 ? Number(value) : null;

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
}

async function leagueExists(leagueId) {
  return (await pool.query('SELECT 1 FROM league WHERE id = $1', [leagueId])).rowCount > 0;
}

router.get('/summary', async (req, res) => {
  const leagueId = id(req.params.leagueId);
  if (!leagueId) return res.status(400).json({ message: '유효한 리그 ID가 필요합니다.' });

  try {
    if (!(await leagueExists(leagueId))) return res.status(404).json({ message: '리그를 찾을 수 없습니다.' });

    const result = await pool.query(`
      SELECT TO_CHAR(gd.game_date, 'YYYY-MM-DD') AS date,
        (COUNT(a.id) > 0) AS "isRegistered",
        COUNT(a.id) FILTER (WHERE a.status = 'PRESENT')::int AS "totalCount",
        COUNT(a.id) FILTER (WHERE a.status = 'PRESENT' AND a.grade_snapshot = 'REGULAR')::int AS "memberCount",
        COUNT(a.id) FILTER (WHERE a.status = 'PRESENT' AND a.grade_snapshot = 'GUEST')::int AS "guestCount"
      FROM game_day gd
      LEFT JOIN attendance a ON a.game_day_id = gd.id
      WHERE gd.league_id = $1
        AND EXISTS (SELECT 1 FROM game g WHERE g.game_day_id = gd.id)
      GROUP BY gd.id, gd.game_date
      ORDER BY gd.game_date DESC
    `, [leagueId]);

    return res.json({ leagueId, dates: result.rows });
  } catch (error) {
    console.error('Public attendance summary query failed:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
  }
});

router.get('/rates', async (req, res) => {
  const leagueId = id(req.params.leagueId);
  if (!leagueId) return res.status(400).json({ message: '유효한 리그 ID가 필요합니다.' });
  try {
    if (!(await leagueExists(leagueId))) return res.status(404).json({ message: '리그를 찾을 수 없습니다.' });
    const result = await pool.query(`
      WITH attendance_days AS (
        SELECT gd.id FROM game_day gd
        WHERE gd.league_id = $1 AND EXISTS (SELECT 1 FROM attendance a WHERE a.game_day_id = gd.id)
      )
      SELECT lm.id AS "leagueMemberId", lm.member_id AS "memberId", lm.team_id AS "teamId", t.name AS "teamName", m.name, m.grade AS "memberType",
        COUNT(a.id) FILTER (WHERE a.status = 'PRESENT')::int AS "attendanceCount",
        (SELECT COUNT(*) FROM attendance_days)::int AS "totalAttendanceDays"
      FROM league_member lm
      JOIN member m ON m.id = lm.member_id
      LEFT JOIN team t ON t.id = lm.team_id
      LEFT JOIN attendance a ON a.league_member_id = lm.id AND a.game_day_id IN (SELECT id FROM attendance_days)
      WHERE lm.league_id = $1 AND m.is_active = TRUE
      GROUP BY lm.id, lm.member_id, lm.team_id, t.name, m.name, m.grade
      ORDER BY m.name, lm.member_id
    `, [leagueId]);
    const participants = result.rows.map(row => {
      const attendanceCount = Number(row.attendanceCount);
      const totalAttendanceDays = Number(row.totalAttendanceDays);
      return { ...row, attendanceCount, totalAttendanceDays, attendanceRate: totalAttendanceDays ? Number(((attendanceCount / totalAttendanceDays) * 100).toFixed(1)) : 0 };
    });
    res.json({ leagueId, totalAttendanceDays: participants[0]?.totalAttendanceDays || 0, participants });
  } catch (error) {
    console.error('League attendance rates query failed:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
  }
});

router.get('/', async (req, res) => {
  const leagueId = id(req.params.leagueId);
  const attendanceDate = validDate(req.query.date);
  if (!leagueId || !attendanceDate) return res.status(400).json({ message: '유효한 리그 ID와 경기 날짜가 필요합니다.' });

  try {
    if (!(await leagueExists(leagueId))) return res.status(404).json({ message: '리그를 찾을 수 없습니다.' });

    const gameDay = await pool.query(`
      SELECT gd.id
      FROM game_day gd
      WHERE gd.league_id = $1 AND gd.game_date = $2
        AND EXISTS (SELECT 1 FROM game g WHERE g.game_day_id = gd.id)
    `, [leagueId, attendanceDate]);
    if (!gameDay.rowCount) return res.status(404).json({ message: '해당 날짜에 등록된 경기가 없습니다.' });

    const result = await pool.query(`
      SELECT a.member_id AS id, m.name,
        CASE a.grade_snapshot WHEN 'REGULAR' THEN 'MEMBER' ELSE 'GUEST' END AS type,
        a.actual_team_id AS "teamId", t.name AS "teamName"
      FROM attendance a
      JOIN member m ON m.id = a.member_id
      LEFT JOIN team t ON t.id = a.actual_team_id
      WHERE a.game_day_id = $1 AND a.status = 'PRESENT'
    `, [gameDay.rows[0].id]);

    const nameCollator = new Intl.Collator('ko-KR');
    const attendees = result.rows.sort((left, right) => {
      if (left.type !== right.type) return left.type === 'MEMBER' ? -1 : 1;
      return nameCollator.compare(left.name, right.name) || Number(left.id) - Number(right.id);
    });
    const memberCount = attendees.filter(attendee => attendee.type === 'MEMBER').length;
    const guestCount = attendees.length - memberCount;

    return res.json({
      leagueId,
      date: attendanceDate,
      isRegistered: (await pool.query('SELECT 1 FROM attendance WHERE game_day_id = $1 LIMIT 1', [gameDay.rows[0].id])).rowCount > 0,
      totalCount: attendees.length,
      memberCount,
      guestCount,
      attendees
    });
  } catch (error) {
    console.error('Public attendance query failed:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
  }
});

module.exports = router;
module.exports.validDate = validDate;

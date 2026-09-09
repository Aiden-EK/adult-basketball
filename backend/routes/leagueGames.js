const express = require('express');
const pool = require('../db');
const router = express.Router({ mergeParams: true });

router.get('/', async (req, res) => {
  const leagueId = Number(req.params.leagueId);
  if (!Number.isInteger(leagueId) || leagueId < 1) return res.status(400).json({ message: 'Invalid league id' });
  try {
    const result = await pool.query(`SELECT g.id AS "gameId", gd.league_id AS "leagueId", gd.game_date AS "gameDate", g.game_no AS "gameNo", g.scheduled_at AS "scheduledAt", g.status, g.team_a_score AS "homeScore", g.team_b_score AS "awayScore", g.winner_team_id AS "winnerTeamId", json_build_object('id', home.id, 'name', home.name) AS "homeTeam", json_build_object('id', away.id, 'name', away.name) AS "awayTeam" FROM game g JOIN game_day gd ON gd.id = g.game_day_id JOIN team home ON home.id = g.team_a_id JOIN team away ON away.id = g.team_b_id WHERE gd.league_id = $1 ORDER BY gd.game_date DESC, g.game_no ASC, g.id ASC`, [leagueId]);
    res.json(result.rows);
  } catch (error) { console.error('Public games query failed:', error); res.status(500).json({ message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }); }
});

module.exports = router;

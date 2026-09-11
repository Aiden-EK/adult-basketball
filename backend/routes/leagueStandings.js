const express = require('express');
const pool = require('../db');
const { calculateStandings } = require('../services/standings');

const router = express.Router({ mergeParams: true });

function parseLeagueId(value) {
  if (!/^\d+$/.test(String(value))) return null;
  const leagueId = Number(value);
  return Number.isSafeInteger(leagueId) && leagueId > 0 ? leagueId : null;
}

router.get('/', async (req, res) => {
  const leagueId = parseLeagueId(req.params.leagueId);
  if (leagueId === null) return res.status(400).json({ message: 'Invalid league id' });

  try {
    const league = await pool.query('SELECT id FROM league WHERE id = $1', [leagueId]);
    if (league.rowCount === 0) return res.status(404).json({ message: 'League not found' });

    const [teams, games] = await Promise.all([
      pool.query('SELECT id, name FROM team WHERE league_id = $1 ORDER BY sort_order, id', [leagueId]),
      pool.query(`
        SELECT g.id AS "gameId", gd.game_date AS "gameDate", g.scheduled_at AS "scheduledAt", g.game_no AS "gameNo",
               g.team_a_id AS "homeTeamId", g.team_b_id AS "awayTeamId",
               g.team_a_score AS "homeScore", g.team_b_score AS "awayScore",
               g.winner_team_id AS "winnerTeamId", g.result_type AS "resultType", g.status
        FROM game g
        JOIN game_day gd ON gd.id = g.game_day_id
        JOIN team home ON home.id = g.team_a_id AND home.league_id = gd.league_id
        JOIN team away ON away.id = g.team_b_id AND away.league_id = gd.league_id
        WHERE gd.league_id = $1
          AND g.status = 'COMPLETED'
          AND g.team_a_score IS NOT NULL
          AND g.team_b_score IS NOT NULL
      `, [leagueId])
    ]);

    res.json({ leagueId, standings: calculateStandings(teams.rows, games.rows) });
  } catch (error) {
    console.error('League standings query failed:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
  }
});

module.exports = router;

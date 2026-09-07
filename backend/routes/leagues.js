const express = require('express');
const pool = require('../db');

const router = express.Router();

const leagueFields = `
  id,
  name,
  year,
  quarter,
  status,
  started_at AS "startedAt",
  ended_at AS "endedAt",
  created_at AS "createdAt",
  winner_team_id AS "winnerTeamId"
`;

function parseLeagueId(value) {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ${leagueFields}
      FROM league
      ORDER BY year DESC, quarter DESC, id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('League list query failed:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

router.get('/:id', async (req, res) => {
  const id = parseLeagueId(req.params.id);
  if (id === null) {
    return res.status(400).json({ message: 'Invalid league id' });
  }

  try {
    const result = await pool.query(
      `SELECT ${leagueFields} FROM league WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'League not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('League detail query failed:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

module.exports = router;

const express = require('express');
const pool = require('../db');

const router = express.Router();

const createdLeagueFields = `
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

function validateCreateLeague(body) {
  if (!body || typeof body.name !== 'string' || body.name.trim() === '') {
    return 'name is required';
  }

  if (!Number.isInteger(body.year) || body.year < 2000) {
    return 'year must be an integer greater than or equal to 2000';
  }

  if (!Number.isInteger(body.quarter) || body.quarter < 1 || body.quarter > 4) {
    return 'quarter must be an integer between 1 and 4';
  }

  if (body.name.trim().length > 100) {
    return 'name must be 100 characters or fewer';
  }

  return null;
}

router.post('/', async (req, res) => {
  const validationError = validateCreateLeague(req.body);
  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  try {
    const result = await pool.query(
      `
        INSERT INTO league (name, year, quarter)
        VALUES ($1, $2, $3)
        RETURNING ${createdLeagueFields}
      `,
      [req.body.name.trim(), req.body.year, req.body.quarter]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        message: 'League already exists for this year and quarter'
      });
    }

    console.error('League creation failed:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

module.exports = router;

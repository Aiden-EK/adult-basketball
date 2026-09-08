const express = require('express');
const pool = require('../db');
const { LeagueWinnerError, setLeagueWinner } = require('../services/leagueWinner');

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

function isValidStatus(status) {
  return ['PLANNED', 'ACTIVE', 'COMPLETED'].includes(status);
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
    res.status(500).json({ message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
  }
});

router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'Invalid league id' });
  }

  if (!isValidStatus(status)) {
    return res.status(400).json({ message: 'status must be PLANNED, ACTIVE, or COMPLETED' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const leagueResult = await client.query(
      `SELECT id FROM league WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (leagueResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'League not found' });
    }

    if (status === 'ACTIVE') {
      const activeResult = await client.query(
        `SELECT id FROM league WHERE status = 'ACTIVE' AND id <> $1 LIMIT 1 FOR UPDATE`,
        [id]
      );
      if (activeResult.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ message: 'Another active league already exists' });
      }
    }

    const result = await client.query(
      `UPDATE league SET status = $1 WHERE id = $2 RETURNING ${createdLeagueFields}`,
      [status, id]
    );
    await client.query('COMMIT');
    return res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('League status update failed:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
  } finally {
    client.release();
  }
});

router.patch('/:leagueId/winner', async (req, res) => {
  const leagueId=Number(req.params.leagueId), teamId=req.body?.teamId
  if(!Number.isSafeInteger(leagueId)||leagueId<1)return res.status(400).json({message:'Invalid league id'})
  if(!Number.isSafeInteger(teamId)||teamId<1)return res.status(400).json({message:'Invalid team id'})
  const client=await pool.connect()
  try{await client.query('BEGIN');const result=await setLeagueWinner(client,leagueId,teamId);await client.query('COMMIT');res.json(result)}catch(error){await client.query('ROLLBACK');if(error instanceof LeagueWinnerError)return res.status(error.status).json({message:error.message});console.error('League winner update failed:',error);res.status(500).json({message:'서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'})}finally{client.release()}
});

module.exports = router;

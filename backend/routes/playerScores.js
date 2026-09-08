const express = require('express');
const pool = require('../db');
const { PlayerScoreError, readPlayerScores, replacePlayerScores } = require('../services/playerScores');

const router = express.Router({ mergeParams: true });

function parseId(value) {
  return /^\d+$/.test(String(value)) && Number(value) > 0 ? Number(value) : null;
}

router.get('/:gameId/player-scores', async (req, res) => {
  const gameId = parseId(req.params.gameId);
  if (!gameId) return res.status(400).json({ message: 'Invalid game id' });
  try {
    const result = await readPlayerScores(pool, gameId);
    if (!result) return res.status(404).json({ message: '경기를 찾을 수 없습니다.' });
    res.json(result);
  } catch (error) {
    console.error('Player scores query failed:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

router.put('/:gameId/player-scores', async (req, res) => {
  if (!req.baseUrl.startsWith('/api/admin/')) {
    return res.status(403).json({ message: '관리자만 개인 득점을 수정할 수 있습니다.' });
  }
  const gameId = parseId(req.params.gameId);
  if (!gameId) return res.status(400).json({ message: 'Invalid game id' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await replacePlayerScores(client, gameId, req.body?.scores);
    await client.query('COMMIT');
    res.json(await readPlayerScores(pool, gameId));
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof PlayerScoreError) return res.status(error.status).json({ message: error.message });
    console.error('Player scores update failed:', error);
    res.status(500).json({ message: 'Database error' });
  } finally {
    client.release();
  }
});

module.exports = router;

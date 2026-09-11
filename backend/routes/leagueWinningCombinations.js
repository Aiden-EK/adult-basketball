const express = require('express');
const pool = require('../db');
const { readWinningCombinations } = require('../services/winningCombinations');

function winningCombinationsRouter(maxLimit) {
  const router = express.Router({ mergeParams: true });
  router.get('/', async (req, res) => {
    const leagueId = Number(req.params.leagueId);
    const rawLimit = req.query.limit;
    const limit = rawLimit === undefined ? maxLimit : Number(rawLimit);
    if (!Number.isSafeInteger(leagueId) || leagueId < 1) return res.status(400).json({ message: 'Invalid league id' });
    if ((rawLimit !== undefined && (typeof rawLimit !== 'string' || !/^\d+$/.test(rawLimit)))
      || !Number.isInteger(limit) || limit < 1 || limit > maxLimit) {
      return res.status(400).json({ message: `limit은 1부터 ${maxLimit}까지의 정수여야 합니다.` });
    }
    try {
      const league = await pool.query('SELECT id FROM league WHERE id = $1', [leagueId]);
      if (!league.rows.length) return res.status(404).json({ message: 'League not found' });
      res.json(await readWinningCombinations(pool, leagueId, limit));
    } catch (error) {
      console.error('Winning combinations query failed:', error);
      res.status(500).json({ message: '필승조합을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.' });
    }
  });
  return router;
}

module.exports = winningCombinationsRouter;

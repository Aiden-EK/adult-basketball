const express = require('express');
const pool = require('../db');
const { readWinImpact } = require('../services/winImpact');
const router = express.Router({ mergeParams: true });

router.get('/', async (req, res) => {
  const leagueId = Number(req.params.leagueId);
  if (!Number.isInteger(leagueId) || leagueId < 1) return res.status(400).json({ message: 'Invalid league id' });
  try {
    const league = await pool.query('SELECT id FROM league WHERE id = $1', [leagueId]);
    if (!league.rows.length) return res.status(404).json({ message: 'League not found' });
    res.json(await readWinImpact(pool, leagueId));
  } catch (error) { console.error('Win impact query failed:', error); res.status(500).json({ message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }); }
});

module.exports = router;

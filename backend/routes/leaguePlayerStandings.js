const express = require('express');
const pool = require('../db');
const { PlayerStandingsError, readPlayerStandings } = require('../services/playerStandings');
const router = express.Router({ mergeParams: true });
router.get('/', async (req, res) => {
  if (!/^\d+$/.test(String(req.params.leagueId)) || Number(req.params.leagueId) < 1) return res.status(400).json({ message: 'Invalid league id' });
  try { res.json({ leagueId: Number(req.params.leagueId), scorers: await readPlayerStandings(pool, Number(req.params.leagueId)) }); }
  catch (error) { if (error instanceof PlayerStandingsError) return res.status(error.status).json({ message: error.message }); console.error('Player standings query failed:', error); res.status(500).json({ message: 'Database error' }); }
});
module.exports = router;

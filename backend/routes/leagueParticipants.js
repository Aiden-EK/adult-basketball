const express = require('express');
const pool = require('../db');
const router = express.Router({ mergeParams: true });
function parseId(value) { if (!/^\d+$/.test(value)) return null; const id = Number(value); return Number.isSafeInteger(id) && id > 0 ? id : null; }
router.get('/', async (req, res) => { const leagueId = parseId(req.params.leagueId); if (leagueId === null) return res.status(400).json({ message: 'Invalid league id' }); try { const league = await pool.query('SELECT id FROM league WHERE id = $1', [leagueId]); if (league.rows.length === 0) return res.status(404).json({ message: 'League not found' }); const result = await pool.query('SELECT lm.member_id AS "memberId", m.name, m.grade AS "memberType" FROM league_member lm JOIN member m ON m.id = lm.member_id WHERE lm.league_id = $1 ORDER BY m.id', [leagueId]); res.json(result.rows); } catch (error) { console.error('League participants query failed:', error); res.status(500).json({ message: 'Database error' }); } });
module.exports = router;

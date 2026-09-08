const express = require('express');
const pool = require('../db');

const router = express.Router({ mergeParams: true });

function parseId(value) { if (!/^\d+$/.test(value)) return null; const id = Number(value); return Number.isSafeInteger(id) && id > 0 ? id : null; }
async function leagueExists(leagueId) { const result = await pool.query('SELECT id FROM league WHERE id = $1', [leagueId]); return result.rows.length > 0; }

router.get('/', async (req, res) => {
  const leagueId = parseId(req.params.leagueId);
  if (leagueId === null) return res.status(400).json({ message: 'Invalid league id' });
  try {
    if (!(await leagueExists(leagueId))) return res.status(404).json({ message: 'League not found' });
    const result = await pool.query(`
      SELECT m.id AS "memberId", m.name, m.grade AS "memberType", m.is_active AS "isActive",
             (lm.id IS NOT NULL) AS "isParticipant", lm.id AS "participantId"
      FROM member m
      LEFT JOIN league_member lm ON lm.member_id = m.id AND lm.league_id = $1
      ORDER BY m.id
    `, [leagueId]);
    res.json(result.rows);
  } catch (error) { console.error('Admin league participants query failed:', error); res.status(500).json({ message: 'Database error' }); }
});

router.post('/', async (req, res) => {
  const leagueId = parseId(req.params.leagueId);
  const memberId = parseId(String(req.body?.memberId ?? ''));
  if (leagueId === null || memberId === null) return res.status(400).json({ message: 'Valid memberId is required' });
  try {
    if (!(await leagueExists(leagueId))) return res.status(404).json({ message: 'League not found' });
    const member = await pool.query('SELECT id, is_active AS "isActive" FROM member WHERE id = $1', [memberId]);
    if (member.rows.length === 0) return res.status(404).json({ message: 'Member not found' });
    if (!member.rows[0].isActive) return res.status(400).json({ message: 'Inactive member cannot be added' });
    const result = await pool.query('INSERT INTO league_member (league_id, member_id) VALUES ($1, $2) RETURNING id, league_id AS "leagueId", member_id AS "memberId", created_at AS "createdAt"', [leagueId, memberId]);
    res.status(201).json(result.rows[0]);
  } catch (error) { if (error.code === '23505') return res.status(409).json({ message: 'Member already participates in this league' }); console.error('Admin league participant create failed:', error); res.status(500).json({ message: 'Database error' }); }
});

router.delete('/:memberId', async (req, res) => {
  const leagueId = parseId(req.params.leagueId); const memberId = parseId(req.params.memberId);
  if (leagueId === null || memberId === null) return res.status(400).json({ message: 'Invalid participant id' });
  try { const result = await pool.query('DELETE FROM league_member WHERE league_id = $1 AND member_id = $2 RETURNING id', [leagueId, memberId]); if (result.rows.length === 0) return res.status(404).json({ message: 'Participant not found' }); res.status(204).send(); } catch (error) { console.error('Admin league participant delete failed:', error); res.status(500).json({ message: 'Database error' }); }
});

router.put('/', async (req, res) => {
  const leagueId = parseId(req.params.leagueId);
  const memberIds = req.body?.memberIds;
  if (leagueId === null) return res.status(400).json({ message: 'Invalid league id' });
  if (!Array.isArray(memberIds) || !memberIds.every((id) => Number.isSafeInteger(id) && id > 0)) return res.status(400).json({ message: 'memberIds must be an array of positive integers' });
  if (new Set(memberIds).size !== memberIds.length) return res.status(400).json({ message: 'memberIds must not contain duplicates' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const league = await client.query('SELECT id FROM league WHERE id = $1', [leagueId]);
    if (league.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'League not found' }); }
    const current = await client.query('SELECT member_id FROM league_member WHERE league_id = $1', [leagueId]);
    const currentIds = current.rows.map((row) => Number(row.member_id));
    const members = await client.query('SELECT id, is_active AS "isActive" FROM member WHERE id = ANY($1::bigint[])', [memberIds]);
    if (members.rows.length !== memberIds.length) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Member not found' }); }
    const inactiveNew = members.rows.some((member) => !member.isActive && !currentIds.includes(Number(member.id)));
    if (inactiveNew) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Inactive member cannot be added' }); }
    const inactiveExisting = await client.query('SELECT member_id FROM league_member lm JOIN member m ON m.id = lm.member_id WHERE lm.league_id = $1 AND m.is_active = FALSE', [leagueId]);
    const keepInactive = inactiveExisting.rows.map((row) => Number(row.member_id));
    const desired = [...new Set([...memberIds, ...keepInactive])];
    for (const memberId of desired.filter((id) => !currentIds.includes(id))) await client.query('INSERT INTO league_member (league_id, member_id) VALUES ($1, $2)', [leagueId, memberId]);
    for (const memberId of currentIds.filter((id) => !desired.includes(id))) await client.query('DELETE FROM league_member WHERE league_id = $1 AND member_id = $2', [leagueId, memberId]);
    await client.query('COMMIT');
    res.json({ leagueId, memberIds: desired });
  } catch (error) { await client.query('ROLLBACK'); console.error('Admin league participants update failed:', error); res.status(500).json({ message: 'Database error' }); } finally { client.release(); }
});

module.exports = router;

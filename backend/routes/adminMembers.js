const express = require('express');
const pool = require('../db');

const router = express.Router();
const memberFields = `id, name, birth_year AS "birthYear", height, positions, grade AS "memberType", is_active AS "isActive", note, created_at AS "createdAt", updated_at AS "updatedAt"`;
const validTypes = ['REGULAR', 'GUEST'];
function parseBirthYear(value) {
  if (value === undefined || value === null || value === '') return null;
  if (!Number.isInteger(value) || value < 1900 || value > new Date().getFullYear()) return undefined;
  return value;
}

function parseMemberId(value) { if (!/^\d+$/.test(value)) return null; const id = Number(value); return Number.isSafeInteger(id) && id > 0 ? id : null; }
function sendDatabaseError(res, error, action) { console.error(`Admin member ${action} failed:`, error); res.status(500).json({ message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }); }
function getMemberType(body) { return body.member_type ?? body.memberType; }
function validateName(name) { return typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 100; }

router.get('/', async (req, res) => {
  try { const result = await pool.query(`SELECT ${memberFields} FROM member ORDER BY id`); res.json(result.rows); } catch (error) { sendDatabaseError(res, error, 'list'); }
});

router.post('/', async (req, res) => {
  const { name, note } = req.body || {};
  const birthYear = parseBirthYear(req.body?.birthYear ?? req.body?.birth_year);
  const memberType = getMemberType(req.body || {});
  if (!validateName(name)) return res.status(400).json({ message: 'name is required' });
  if (birthYear === undefined) return res.status(400).json({ message: '출생년도는 1900년부터 현재 연도까지 4자리 숫자로 입력해주세요.' });
  if (!validTypes.includes(memberType)) return res.status(400).json({ message: 'member_type must be REGULAR or GUEST' });
  if (note !== undefined && typeof note !== 'string') return res.status(400).json({ message: 'note must be a string' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`INSERT INTO member (name, birth_year, grade, note) VALUES ($1, $2, $3, $4) RETURNING ${memberFields}`, [name.trim(), birthYear, memberType, note || null]);
    const member = result.rows[0];

    // 신규 활성 회원은 현재 진행 중인 모든 리그에 팀 미배정 상태로 참가시킨다.
    if (member.isActive) {
      await client.query(`
        INSERT INTO league_member (league_id, member_id, team_id)
        SELECT id, $1, NULL
        FROM league
        WHERE status = 'ACTIVE'
        ON CONFLICT (league_id, member_id) DO NOTHING
      `, [member.id]);
    }

    await client.query('COMMIT');
    res.status(201).json(member);
  } catch (error) {
    await client.query('ROLLBACK');
    sendDatabaseError(res, error, 'create');
  } finally {
    client.release();
  }
});

router.get('/:id', async (req, res) => {
  const id = parseMemberId(req.params.id);
  if (id === null) return res.status(400).json({ message: 'Invalid member id' });
  try {
    const result = await pool.query(`SELECT ${memberFields} FROM member WHERE id = $1`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Member not found' });
    res.json(result.rows[0]);
  } catch (error) { sendDatabaseError(res, error, 'detail'); }
});

router.patch('/:id/note', async (req, res) => {
  const id = parseMemberId(req.params.id);
  if (id === null) return res.status(400).json({ message: 'Invalid member id' });
  if (!req.body || typeof req.body.note !== 'string') return res.status(400).json({ message: 'note must be a string' });
  try {
    const result = await pool.query('UPDATE member SET note = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, note', [req.body.note === '' ? null : req.body.note, id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Member not found' });
    res.json(result.rows[0]);
  } catch (error) { sendDatabaseError(res, error, 'note update'); }
});

router.patch('/:id', async (req, res) => {
  const id = parseMemberId(req.params.id);
  if (id === null) return res.status(400).json({ message: 'Invalid member id' });
  const body = req.body || {};
  const memberType = getMemberType(body);
  const hasName = body.name !== undefined;
  const hasType = body.member_type !== undefined || body.memberType !== undefined;
  const hasActive = body.active !== undefined;
  const hasBirthYear = body.birthYear !== undefined || body.birth_year !== undefined;
  const birthYear = parseBirthYear(body.birthYear ?? body.birth_year);
  if (!hasName && !hasType && !hasActive && !hasBirthYear) return res.status(400).json({ message: 'No editable fields provided' });
  if (hasName && !validateName(body.name)) return res.status(400).json({ message: 'name is required' });
  if (hasType && !validTypes.includes(memberType)) return res.status(400).json({ message: 'member_type must be REGULAR or GUEST' });
  if (hasActive && typeof body.active !== 'boolean') return res.status(400).json({ message: 'active must be boolean' });
  if (hasBirthYear && birthYear === undefined) return res.status(400).json({ message: '출생년도는 1900년부터 현재 연도까지 4자리 숫자로 입력해주세요.' });

  try {
    const current = await pool.query('SELECT name, birth_year, grade, is_active FROM member WHERE id = $1', [id]);
    if (current.rows.length === 0) return res.status(404).json({ message: 'Member not found' });
    const member = current.rows[0];
    const result = await pool.query(`UPDATE member SET name = $1, birth_year = $2, grade = $3, is_active = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING ${memberFields}`, [hasName ? body.name.trim() : member.name, hasBirthYear ? birthYear : member.birth_year, hasType ? memberType : member.grade, hasActive ? body.active : member.is_active, id]);
    res.json(result.rows[0]);
  } catch (error) { sendDatabaseError(res, error, 'update'); }
});

module.exports = router;

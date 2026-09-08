const express = require('express');
const pool = require('../db');

const router = express.Router();

function parseMemberId(value) {
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

const publicFields = `id, name, grade AS "memberType"`;

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`SELECT ${publicFields} FROM member WHERE is_active = TRUE ORDER BY id`);
    res.json(result.rows);
  } catch (error) {
    console.error('Public member list query failed:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
  }
});

router.get('/:id', async (req, res) => {
  const id = parseMemberId(req.params.id);
  if (id === null) return res.status(400).json({ message: 'Invalid member id' });

  try {
    const result = await pool.query(`SELECT ${publicFields} FROM member WHERE id = $1 AND is_active = TRUE`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Member not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Public member detail query failed:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
  }
});

module.exports = router;

const express = require('express');
const pool = require('../db');

const router = express.Router();

function parseMemberId(value) {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function sendDatabaseError(res, error, action) {
  console.error(`Admin member ${action} failed:`, error);
  res.status(500).json({ message: 'Database error' });
}

const memberFields = `
  id,
  name,
  birth_year AS "birthYear",
  height,
  positions,
  grade AS "memberType",
  is_active AS "isActive",
  note,
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ${memberFields}
      FROM member
      ORDER BY id
    `);

    res.json(result.rows);
  } catch (error) {
    sendDatabaseError(res, error, 'list');
  }
});

router.get('/:id', async (req, res) => {
  const id = parseMemberId(req.params.id);
  if (id === null) {
    return res.status(400).json({ message: 'Invalid member id' });
  }

  try {
    const result = await pool.query(
      `SELECT ${memberFields} FROM member WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Member not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    sendDatabaseError(res, error, 'detail');
  }
});

router.patch('/:id/note', async (req, res) => {
  const id = parseMemberId(req.params.id);
  if (id === null) {
    return res.status(400).json({ message: 'Invalid member id' });
  }

  if (!req.body || typeof req.body.note !== 'string') {
    return res.status(400).json({ message: 'note must be a string' });
  }

  const note = req.body.note === '' ? null : req.body.note;

  try {
    const result = await pool.query(
      `
        UPDATE member
        SET note = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING id, note
      `,
      [note, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Member not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    sendDatabaseError(res, error, 'note update');
  }
});

module.exports = router;

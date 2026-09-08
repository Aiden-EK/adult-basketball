const express = require('express');
const pool = require('../db');
const { COOKIE_NAME, requireAuth } = require('../middleware/auth');
const { SESSION_DAYS, verifyPassword, createSessionToken, hashSessionToken, cookieOptions, serializeCookie, readCookie } = require('../services/auth');
const router = express.Router();

router.post('/login', async (req, res) => {
  const loginId = String(req.body?.loginId || '').trim(); const password = req.body?.password;
  if (!loginId || typeof password !== 'string') return res.status(400).json({ message: '로그인 ID와 비밀번호를 입력하세요.' });
  try {
    const found = await pool.query('SELECT id, login_id AS "loginId", name, role, password_hash AS "passwordHash" FROM admin_account WHERE login_id=$1 AND is_active=TRUE', [loginId]);
    const account = found.rows[0];
    if (!account || !(await verifyPassword(password, account.passwordHash))) return res.status(401).json({ message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    const token = createSessionToken();
    await pool.query(`INSERT INTO admin_session(admin_account_id,token_hash,expires_at) VALUES($1,$2,CURRENT_TIMESTAMP+($3||' days')::interval)`, [account.id, hashSessionToken(token), SESSION_DAYS]);
    res.setHeader('Set-Cookie', serializeCookie(COOKIE_NAME, token));
    res.json({ authenticated: true, user: { id: account.id, loginId: account.loginId, name: account.name, role: account.role } });
  } catch (error) { console.error('Login failed'); res.status(500).json({ message: '로그인을 처리하지 못했습니다.' }); }
});
router.get('/me', (req, res) => res.json({ authenticated: Boolean(req.user), user: req.user || null }));
router.post('/logout', requireAuth, async (req, res) => {
  const token = readCookie(req.headers.cookie, COOKIE_NAME);
  if (token) await pool.query('DELETE FROM admin_session WHERE token_hash=$1', [hashSessionToken(token)]);
  res.setHeader('Set-Cookie', serializeCookie(COOKIE_NAME, '', { ...cookieOptions(), maxAge: 0 }));
  res.json({ authenticated: false, user: null });
});
module.exports = router;

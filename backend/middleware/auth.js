const pool = require('../db');
const { hashSessionToken, readCookie } = require('../services/auth');
const COOKIE_NAME = 'admin_session';

async function loadUser(req, _res, next) {
  req.user = null;
  const token = readCookie(req.headers.cookie, COOKIE_NAME);
  if (!token) return next();
  try {
    const result = await pool.query(`SELECT a.id, a.login_id AS "loginId", a.name, a.role
      FROM admin_session s JOIN admin_account a ON a.id=s.admin_account_id
      WHERE s.token_hash=$1 AND s.expires_at>CURRENT_TIMESTAMP AND a.is_active=TRUE`, [hashSessionToken(token)]);
    req.user = result.rows[0] || null;
    next();
  } catch (error) { next(error); }
}
function requireAuth(req, res, next) { if (!req.user) return res.status(401).json({ message: '로그인이 필요합니다.' }); next(); }
function requireAdmin(req, res, next) { if (!req.user) return res.status(401).json({ message: '로그인이 필요합니다.' }); if (req.user.role !== 'ADMIN') return res.status(403).json({ message: '관리자 권한이 필요합니다.' }); next(); }
module.exports = { COOKIE_NAME, loadUser, requireAuth, requireAdmin };

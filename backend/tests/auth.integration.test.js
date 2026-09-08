const assert = require('node:assert/strict'); const crypto = require('crypto'); const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const pool = require('../db'); const { hashPassword, createSessionToken, hashSessionToken } = require('../services/auth');
const base = process.env.AUTH_TEST_BASE_URL || 'http://localhost:3000/api'; const loginId = `[TEST]-auth-${Date.now()}`; const password = crypto.randomBytes(18).toString('base64url');
async function request(pathname, options = {}) { const response = await fetch(base + pathname, options); return { status: response.status, headers: response.headers, body: await response.json().catch(() => ({})) } }
async function main() {
  const hash = await hashPassword(password);
  try {
    const admin = (await pool.query("INSERT INTO admin_account(login_id,name,password_hash,role) VALUES($1,'[TEST] 관리자',$2,'ADMIN') RETURNING id", [loginId, hash])).rows[0];
    const member = (await pool.query("INSERT INTO admin_account(login_id,name,password_hash,role) VALUES($1,'[TEST] 일반',$2,'MEMBER') RETURNING id", [loginId + '-member', hash])).rows[0];
    assert.equal((await request('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loginId: 'missing', password }) })).status, 401);
    assert.equal((await request('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loginId, password: 'wrong' }) })).status, 401);
    const login = await request('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loginId, password }) }); assert.equal(login.status, 200); assert.equal(login.body.user.role, 'ADMIN'); assert.equal('passwordHash' in login.body.user, false);
    const cookie = login.headers.get('set-cookie').split(';')[0]; assert.match(login.headers.get('set-cookie'), /HttpOnly/); assert.equal((await request('/auth/me', { headers: { Cookie: cookie } })).body.authenticated, true);
    assert.equal((await request('/admin/members', { headers: { Cookie: cookie } })).status, 200); assert.equal((await request('/admin/members')).status, 401); assert.equal((await request('/leagues')).status, 200);
    const memberToken = createSessionToken(); await pool.query("INSERT INTO admin_session(admin_account_id,token_hash,expires_at) VALUES($1,$2,CURRENT_TIMESTAMP+INTERVAL '1 hour')", [member.id, hashSessionToken(memberToken)]); assert.equal((await request('/admin/members', { headers: { Cookie: `admin_session=${memberToken}` } })).status, 403);
    assert.equal((await request('/auth/logout', { method: 'POST', headers: { Cookie: cookie } })).status, 200); assert.equal((await request('/auth/me', { headers: { Cookie: cookie } })).body.authenticated, false);
    assert.equal((await pool.query('SELECT COUNT(*)::int count FROM admin_session WHERE admin_account_id=$1', [admin.id])).rows[0].count, 0);
    console.log('인증 통합 테스트 10개 통과');
  } finally { await pool.query("DELETE FROM admin_account WHERE login_id LIKE '[TEST]-auth-%'"); await pool.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1 });

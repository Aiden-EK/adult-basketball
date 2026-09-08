const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path');
const { hashPassword, verifyPassword, createSessionToken, hashSessionToken, serializeCookie, readCookie, validateAdminPassword } = require('../services/auth');
const { requireAuth, requireAdmin } = require('../middleware/auth');
async function main() {
  const hash = await hashPassword('test-password-only');
  assert.equal(await verifyPassword('test-password-only', hash), true); assert.equal(await verifyPassword('wrong-password', hash), false);
  assert.equal(hash.includes('test-password-only'), false);
  assert.equal(validateAdminPassword('StrongPass123', 'operator'), null);
  assert.match(validateAdminPassword('short1', 'operator'), /10자/);
  assert.match(validateAdminPassword('lettersOnlyPassword', 'operator'), /영문과 숫자/);
  assert.match(validateAdminPassword('password123', 'operator'), /단순/);
  assert.match(validateAdminPassword('operator12345', 'operator'), /ID/);
  const token = createSessionToken(); assert.notEqual(hashSessionToken(token), token);
  const cookie = serializeCookie('admin_session', token); assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=strict/); assert.equal(readCookie(cookie, 'admin_session'), token);
  const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } });
  let res = response(); requireAuth({ user: null }, res, () => {}); assert.equal(res.statusCode, 401);
  res = response(); requireAdmin({ user: { role: 'MEMBER' } }, res, () => {}); assert.equal(res.statusCode, 403);
  let passed = false; requireAdmin({ user: { role: 'ADMIN' } }, response(), () => { passed = true }); assert.equal(passed, true);
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.ok(server.indexOf("app.use('/api/admin', requireAdmin)") < server.indexOf("app.use('/api/admin/members'"));
  assert.equal((server.match(/app\.use\('\/api\/admin(?!', requireAdmin)/g) || []).length, 6);
  console.log('인증 단위 테스트 통과');
}
main().catch(error => { console.error(error); process.exitCode = 1 });

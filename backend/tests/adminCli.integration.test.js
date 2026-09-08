const assert = require('node:assert/strict');
const crypto = require('crypto');
const path = require('path');
const { spawnSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });
const pool = require('../db');
const { verifyPassword } = require('../services/auth');

const backendDirectory = path.join(__dirname, '..');
const loginId = `[TEST]-admin-cli-${crypto.randomBytes(8).toString('hex')}`;
const firstPassword = `${crypto.randomBytes(18).toString('base64url')}A1`;
const nextPassword = `${crypto.randomBytes(18).toString('base64url')}B2`;

function run(script, environment) {
  return spawnSync(process.execPath, [script], {
    cwd: backendDirectory,
    env: { ...process.env, ...environment },
    encoding: 'utf8'
  });
}

async function main() {
  try {
    const created = run('scripts/setupAdmin.js', { ADMIN_LOGIN_ID: loginId, ADMIN_NAME: '[TEST] CLI 관리자', ADMIN_PASSWORD: firstPassword });
    assert.equal(created.status, 0, created.stderr);
    assert.equal(created.stdout.includes(firstPassword), false, '생성 로그에 비밀번호가 없어야 한다');

    const beforeDuplicate = (await pool.query('SELECT password_hash FROM admin_account WHERE login_id=$1', [loginId])).rows[0].password_hash;
    const duplicate = run('scripts/setupAdmin.js', { ADMIN_LOGIN_ID: loginId, ADMIN_NAME: '[TEST] 중복', ADMIN_PASSWORD: nextPassword });
    assert.notEqual(duplicate.status, 0, '동일 ID 생성을 거부해야 한다');
    assert.match(duplicate.stderr, /이미 존재/);
    const afterDuplicate = (await pool.query('SELECT password_hash FROM admin_account WHERE login_id=$1', [loginId])).rows[0].password_hash;
    assert.equal(afterDuplicate, beforeDuplicate, '중복 시 기존 hash를 변경하지 않아야 한다');

    await pool.query(`INSERT INTO admin_session(admin_account_id,token_hash,expires_at)
      SELECT id,repeat('a',64),CURRENT_TIMESTAMP+INTERVAL '1 hour' FROM admin_account WHERE login_id=$1`, [loginId]);
    const changed = run('scripts/changeAdminPassword.js', { ADMIN_LOGIN_ID: loginId, ADMIN_NEW_PASSWORD: nextPassword });
    assert.equal(changed.status, 0, changed.stderr);
    assert.equal(changed.stdout.includes(nextPassword), false, '변경 로그에 비밀번호가 없어야 한다');

    const account = (await pool.query('SELECT id,password_hash FROM admin_account WHERE login_id=$1', [loginId])).rows[0];
    assert.equal(await verifyPassword(nextPassword, account.password_hash), true, '새 비밀번호 hash를 저장해야 한다');
    assert.equal((await pool.query('SELECT count(*)::int count FROM admin_session WHERE admin_account_id=$1', [account.id])).rows[0].count, 0, '기존 세션을 삭제해야 한다');

    const listed = run('scripts/listAdmins.js', {});
    assert.equal(listed.status, 0, listed.stderr);
    assert.match(listed.stdout, /관리자 ID/);
    assert.equal(/password|hash|token|cookie|secret/i.test(listed.stdout), false, '목록에 인증 비밀정보가 없어야 한다');
    console.log('관리자 CLI 통합 테스트 9개 통과');
  } finally {
    await pool.query('DELETE FROM admin_account WHERE login_id=$1', [loginId]);
    await pool.end();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });

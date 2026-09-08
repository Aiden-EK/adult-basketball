const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });
const pool = require('../db');
const { hashPassword, validateAdminPassword } = require('../services/auth');
const { readValue, readPassword } = require('./adminCli');

async function main() {
  const loginId = await readValue('관리자 ID: ', 'ADMIN_LOGIN_ID');
  const password = await readPassword('새 비밀번호: ', 'ADMIN_NEW_PASSWORD');
  if (!loginId) throw new Error('관리자 ID를 입력해야 합니다.');
  const passwordError = validateAdminPassword(password, loginId);
  if (passwordError) throw new Error(passwordError);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const account = await client.query("SELECT id FROM admin_account WHERE login_id=$1 AND role='ADMIN' AND is_active=TRUE FOR UPDATE", [loginId]);
    if (account.rowCount === 0) throw new Error('활성 관리자 계정을 찾을 수 없습니다.');
    const passwordHash = await hashPassword(password);
    await client.query('UPDATE admin_account SET password_hash=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2', [passwordHash, account.rows[0].id]);
    await client.query('DELETE FROM admin_session WHERE admin_account_id=$1', [account.rows[0].id]);
    await client.query('COMMIT');
    console.log('관리자 비밀번호가 변경되었고 기존 세션이 모두 만료되었습니다.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());

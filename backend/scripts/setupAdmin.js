const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const pool = require('../db');
const { hashPassword } = require('../services/auth');

async function main() {
  const loginId = String(process.env.ADMIN_LOGIN_ID || '').trim();
  const name = String(process.env.ADMIN_NAME || '').trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!loginId || !name || typeof password !== 'string' || password.length < 10) throw new Error('ADMIN_LOGIN_ID, ADMIN_NAME, 10자 이상의 ADMIN_PASSWORD가 필요합니다.');
  const passwordHash = await hashPassword(password);
  await pool.query(`INSERT INTO admin_account(login_id,name,password_hash,role) VALUES($1,$2,$3,'ADMIN')
    ON CONFLICT(login_id) DO UPDATE SET name=EXCLUDED.name,password_hash=EXCLUDED.password_hash,role='ADMIN',is_active=TRUE,updated_at=CURRENT_TIMESTAMP`, [loginId, name, passwordHash]);
  console.log('관리자 계정 설정이 완료되었습니다.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());

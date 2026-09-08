const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });
const pool = require('../db');
const { hashPassword, validateAdminPassword } = require('../services/auth');
const { readValue, readPassword } = require('./adminCli');

async function main() {
  const loginId = await readValue('관리자 ID: ', 'ADMIN_LOGIN_ID');
  const name = await readValue('관리자 이름: ', 'ADMIN_NAME');
  const password = await readPassword('관리자 비밀번호: ', 'ADMIN_PASSWORD');
  if (!loginId || !name) throw new Error('관리자 ID와 이름을 모두 입력해야 합니다.');
  if (loginId.length > 100 || name.length > 100) throw new Error('관리자 ID와 이름은 각각 100자 이하여야 합니다.');
  const passwordError = validateAdminPassword(password, loginId);
  if (passwordError) throw new Error(passwordError);
  const duplicate = await pool.query('SELECT 1 FROM admin_account WHERE login_id=$1', [loginId]);
  if (duplicate.rowCount > 0) throw new Error('이미 존재하는 관리자 ID입니다. 비밀번호 변경 명령을 사용하세요.');
  const passwordHash = await hashPassword(password);
  try {
    await pool.query("INSERT INTO admin_account(login_id,name,password_hash,role) VALUES($1,$2,$3,'ADMIN')", [loginId, name, passwordHash]);
  } catch (error) {
    if (error.code === '23505') throw new Error('이미 존재하는 관리자 ID입니다. 비밀번호 변경 명령을 사용하세요.');
    throw error;
  }
  console.log('관리자 계정이 생성되었습니다.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());

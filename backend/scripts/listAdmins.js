const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });
const pool = require('../db');

async function main() {
  const result = await pool.query(`SELECT login_id AS "관리자 ID", role AS "권한",
    CASE WHEN is_active THEN '활성' ELSE '비활성' END AS "상태",
    to_char(created_at AT TIME ZONE 'Asia/Seoul','YYYY-MM-DD HH24:MI:SS') AS "생성일(KST)"
    FROM admin_account ORDER BY created_at, id`);
  if (result.rowCount === 0) return console.log('등록된 관리자 계정이 없습니다.');
  console.table(result.rows);
}

main().catch(error => { console.error(`관리자 목록을 확인하지 못했습니다: ${error.message}`); process.exitCode = 1; }).finally(() => pool.end());

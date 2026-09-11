// Default is a read-only preview. --apply repairs only unambiguous missing NORMAL winners.
const fs = require('node:fs');
const path = require('node:path');
require('../backend/node_modules/dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const pool = require('../backend/db');

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT g.id, g.game_day_id, g.game_no, gd.game_date::text,
      g.team_a_id, ta.name AS team_a_name, g.team_a_score, g.team_b_id, tb.name AS team_b_name, g.team_b_score,
      g.status, g.result_type, g.winner_team_id, g.created_at, g.updated_at,
      CASE WHEN g.team_a_score > g.team_b_score THEN g.team_a_id ELSE g.team_b_id END AS resolved_winner_team_id
      FROM game g JOIN game_day gd ON gd.id=g.game_day_id JOIN league l ON l.id=gd.league_id
      JOIN team ta ON ta.id=g.team_a_id AND ta.league_id=l.id JOIN team tb ON tb.id=g.team_b_id AND tb.league_id=l.id
      WHERE l.status='ACTIVE' AND g.status='COMPLETED' AND COALESCE(g.result_type,'NORMAL')='NORMAL'
      AND g.winner_team_id IS NULL AND g.team_a_score IS NOT NULL AND g.team_b_score IS NOT NULL
      AND g.team_a_score<>g.team_b_score AND g.team_a_score>=0 AND g.team_b_score>=0
      ORDER BY gd.game_date,g.game_no FOR UPDATE OF g`);
    console.log(JSON.stringify(rows, null, 2));
    if (!process.argv.includes('--apply') || !rows.length) {
      await client.query('ROLLBACK');
      console.log(`보정 대상 ${rows.length}건. ${rows.length ? '--apply로 적용할 수 있습니다.' : '변경 없음.'}`);
      return;
    }
    const directory = path.join(__dirname, '../backups');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, `game-winners-${Date.now()}.json`), JSON.stringify(rows, null, 2));
    const repaired = [];
    for (const row of rows) {
      const result = await client.query(`UPDATE game SET winner_team_id=$2,result_type='NORMAL',updated_at=CURRENT_TIMESTAMP
        WHERE id=$1 AND winner_team_id IS NULL RETURNING id,result_type,winner_team_id,updated_at`, [row.id, row.resolved_winner_team_id]);
      repaired.push(result.rows[0]);
    }
    await client.query('COMMIT');
    console.log('보정 완료:', JSON.stringify(repaired, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); await pool.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

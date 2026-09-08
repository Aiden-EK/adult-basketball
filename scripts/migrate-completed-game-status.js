const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dotenv = require('../backend/node_modules/dotenv');
const { Pool } = require('../backend/node_modules/pg');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const files = [
  { leagueId: 5, file: '2026-q1-games.csv', expectedGames: 24 },
  { leagueId: 6, file: '2026-q2-games.csv', expectedGames: 31 },
  { leagueId: 7, file: '2026-q3-games.csv', expectedGames: 30 },
];
const headers = ['date', 'game_no', 'team_a', 'team_b', 'team_a_score', 'team_b_score', 'winner', 'result_type', 'note'];

function parseCsvLine(line) {
  const values = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === ',' && !quoted) {
      values.push(value); value = '';
    } else value += character;
  }
  values.push(value);
  return values;
}

function readRows({ leagueId, file }) {
  const lines = fs.readFileSync(path.join(__dirname, '..', 'data', 'import', file), 'utf8')
    .replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  const actualHeaders = parseCsvLine(lines.shift());
  if (actualHeaders.join(',') !== headers.join(',')) throw new Error(`${file}: CSV header mismatch`);
  return lines.filter(Boolean).map((line, index) => {
    const values = parseCsvLine(line);
    if (values.length !== headers.length) throw new Error(`${file}:${index + 2}: invalid column count`);
    const row = Object.fromEntries(headers.map((header, column) => [header, values[column].trim()]));
    return { ...row, leagueId, game_no: Number(row.game_no), team_a_score: Number(row.team_a_score), team_b_score: Number(row.team_b_score) };
  });
}

function resultChecksum(rows) {
  const preservedFields = rows.map(row => ({
    id: Number(row.id),
    game_day_id: Number(row.game_day_id),
    game_no: row.game_no,
    team_a_id: Number(row.team_a_id),
    team_b_id: Number(row.team_b_id),
    team_a_score: row.team_a_score,
    team_b_score: row.team_b_score,
    winner_team_id: Number(row.winner_team_id),
    result_type: row.result_type,
  }));
  return crypto.createHash('sha256').update(JSON.stringify(preservedFields)).digest('hex');
}

async function readTargetGames(client) {
  return (await client.query(`
    SELECT g.id, g.game_day_id, g.game_no, gd.game_date::text, gd.league_id,
           g.team_a_id, team_a.name AS team_a_name, g.team_a_score,
           g.team_b_id, team_b.name AS team_b_name, g.team_b_score,
           g.winner_team_id, winner.name AS winner_name, g.result_type, g.status
    FROM game g
    JOIN game_day gd ON gd.id = g.game_day_id
    JOIN team team_a ON team_a.id = g.team_a_id AND team_a.league_id = gd.league_id
    JOIN team team_b ON team_b.id = g.team_b_id AND team_b.league_id = gd.league_id
    JOIN team winner ON winner.id = g.winner_team_id AND winner.league_id = gd.league_id
    WHERE gd.league_id = ANY($1::bigint[])
    ORDER BY gd.league_id, gd.game_date, g.game_no, g.id
    FOR UPDATE OF g
  `, [files.map(file => file.leagueId)])).rows;
}

function validateAgainstCsv(dbRows, csvRows) {
  if (dbRows.length !== csvRows.length) throw new Error(`Expected ${csvRows.length} games, found ${dbRows.length}`);
  const csvByKey = new Map(csvRows.map(row => [`${row.leagueId}/${row.date}/${row.game_no}`, row]));
  for (const dbRow of dbRows) {
    const key = `${dbRow.league_id}/${dbRow.game_date}/${dbRow.game_no}`;
    const csvRow = csvByKey.get(key);
    if (!csvRow) throw new Error(`Unexpected database game: ${key}`);
    const matches = dbRow.team_a_name === csvRow.team_a
      && dbRow.team_b_name === csvRow.team_b
      && dbRow.team_a_score === csvRow.team_a_score
      && dbRow.team_b_score === csvRow.team_b_score
      && dbRow.winner_name === csvRow.winner
      && dbRow.result_type === csvRow.result_type;
    if (!matches) throw new Error(`Database result differs from CSV: ${key}`);
    if (!['SCHEDULED', 'COMPLETED'].includes(dbRow.status)) throw new Error(`Unexpected status at ${key}: ${dbRow.status}`);
  }
  for (const file of files) {
    const count = dbRows.filter(row => Number(row.league_id) === file.leagueId).length;
    if (count !== file.expectedGames) throw new Error(`League ${file.leagueId}: expected ${file.expectedGames} games, found ${count}`);
  }
}

async function main() {
  const csvRows = files.flatMap(readRows);
  if (csvRows.length !== 85) throw new Error(`Expected 85 CSV rows, found ${csvRows.length}`);
  const pool = new Pool({ host: process.env.POSTGRES_HOST || 'localhost', port: Number(process.env.POSTGRES_PORT || 5432), database: process.env.POSTGRES_DB, user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const before = await readTargetGames(client);
    validateAgainstCsv(before, csvRows);
    const beforeChecksum = resultChecksum(before);
    const beforeStatus = { SCHEDULED: before.filter(row => row.status === 'SCHEDULED').length, COMPLETED: before.filter(row => row.status === 'COMPLETED').length };

    const updated = await client.query(`
      UPDATE game g
      SET status = 'COMPLETED'
      FROM game_day gd, team team_a, team team_b, team winner
      WHERE g.game_day_id = gd.id
        AND team_a.id = g.team_a_id AND team_a.league_id = gd.league_id
        AND team_b.id = g.team_b_id AND team_b.league_id = gd.league_id
        AND winner.id = g.winner_team_id AND winner.league_id = gd.league_id
        AND gd.league_id = ANY($1::bigint[])
        AND g.id = ANY($2::bigint[])
        AND g.team_a_score IS NOT NULL AND g.team_b_score IS NOT NULL
        AND g.winner_team_id IS NOT NULL AND g.result_type IS NOT NULL
        AND g.status = 'SCHEDULED'
      RETURNING g.id
    `, [files.map(file => file.leagueId), before.map(row => row.id)]);

    const after = await readTargetGames(client);
    validateAgainstCsv(after, csvRows);
    const afterChecksum = resultChecksum(after);
    if (beforeChecksum !== afterChecksum) throw new Error('Non-status game data changed; rolling back');
    if (after.some(row => row.status !== 'COMPLETED')) throw new Error('Some imported games are not COMPLETED; rolling back');

    await client.query('COMMIT');
    console.log(JSON.stringify({
      targetGames: after.length,
      updatedGames: updated.rowCount,
      updatedByLeague: files.map(file => ({ leagueId: file.leagueId, count: updated.rows.filter(row => before.find(game => Number(game.id) === Number(row.id) && Number(game.league_id) === file.leagueId)).length })),
      beforeStatus,
      afterStatus: { SCHEDULED: 0, COMPLETED: after.length },
      preservedDataChecksum: beforeChecksum,
      checksumMatches: beforeChecksum === afterChecksum,
    }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();

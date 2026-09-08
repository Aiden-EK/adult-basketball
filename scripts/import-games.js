const fs = require('fs');
const path = require('path');
const dotenv = require('../backend/node_modules/dotenv');
const { Pool } = require('../backend/node_modules/pg');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const files = [
  { leagueId: 5, file: '2026-q1-games.csv' },
  { leagueId: 6, file: '2026-q2-games.csv' },
  { leagueId: 7, file: '2026-q3-games.csv' },
];
const teamOrder = { '화이트': 1, '블랙': 2, '컬러': 3 };
const resultTypes = new Set(['NORMAL', 'TIEBREAK', 'FORFEIT']);
const headers = ['date', 'game_no', 'team_a', 'team_b', 'team_a_score', 'team_b_score', 'winner', 'result_type', 'note'];

function parseCsvLine(line) {
  const values = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      values.push(value); value = '';
    } else value += char;
  }
  values.push(value);
  return values;
}

function readCsv(file) {
  const lines = fs.readFileSync(path.join(__dirname, '..', 'data', 'import', file), 'utf8')
    .replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  const actualHeaders = parseCsvLine(lines.shift());
  if (actualHeaders.join(',') !== headers.join(',')) throw new Error(`${file}: CSV header mismatch`);
  return lines.filter(Boolean).map((line, index) => {
    const values = parseCsvLine(line);
    if (values.length !== headers.length) throw new Error(`${file}:${index + 2}: invalid column count`);
    const row = Object.fromEntries(headers.map((header, i) => [header, values[i].trim()]));
    row.source = `${file}:${index + 2}`;
    row.game_no = Number(row.game_no); row.team_a_score = Number(row.team_a_score); row.team_b_score = Number(row.team_b_score);
    return row;
  });
}

function validateRows(rows, file) {
  const errors = [];
  const seen = new Set();
  for (const row of rows) {
    const key = `${row.date}/${row.game_no}`;
    if (seen.has(key)) errors.push(`${row.source}: duplicate date/game_no ${key}`);
    seen.add(key);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) errors.push(`${row.source}: invalid date`);
    if (!Number.isInteger(row.game_no) || row.game_no < 1) errors.push(`${row.source}: invalid game_no`);
    if (![row.team_a, row.team_b, row.winner].every((team) => team in teamOrder)) errors.push(`${row.source}: unknown team`);
    if (row.team_a === row.team_b) errors.push(`${row.source}: teams must differ`);
    if (!Number.isInteger(row.team_a_score) || row.team_a_score < 0 || !Number.isInteger(row.team_b_score) || row.team_b_score < 0) errors.push(`${row.source}: invalid score`);
    if (!resultTypes.has(row.result_type)) errors.push(`${row.source}: invalid result_type`);
    if (row.winner !== row.team_a && row.winner !== row.team_b) errors.push(`${row.source}: winner is not a participant`);
    if (row.result_type === 'NORMAL' && row.team_a_score === row.team_b_score) errors.push(`${row.source}: NORMAL game is tied`);
    if (row.result_type === 'NORMAL' && ((row.team_a_score > row.team_b_score ? row.team_a : row.team_b) !== row.winner)) errors.push(`${row.source}: NORMAL winner does not match score`);
  }
  return errors;
}

function sameGame(db, row, teams) {
  return db.team_a_id === teams[row.team_a].id && db.team_b_id === teams[row.team_b].id &&
    db.team_a_score === row.team_a_score && db.team_b_score === row.team_b_score &&
    db.winner_team_id === teams[row.winner].id && db.result_type === row.result_type &&
    db.status === 'COMPLETED' && (db.note || '') === row.note;
}

async function main() {
  const pool = new Pool({ host: process.env.POSTGRES_HOST || 'localhost', port: Number(process.env.POSTGRES_PORT || 5432), database: process.env.POSTGRES_DB, user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD });
  const client = await pool.connect();
  try {
    const allRows = files.flatMap(({ leagueId, file }) => readCsv(file).map((row) => ({ ...row, leagueId })));
    const validationErrors = files.flatMap(({ file }) => validateRows(readCsv(file), file));
    if (validationErrors.length) throw new Error(`CSV validation failed:\n${validationErrors.join('\n')}`);
    const leagueResult = await client.query('SELECT id, year, quarter FROM league WHERE id = ANY($1::bigint[])', [files.map((f) => f.leagueId)]);
    if (leagueResult.rows.length !== files.length || leagueResult.rows.some((l) => l.year !== 2026 || l.quarter !== l.id - 4)) throw new Error('League 5/6/7 preflight check failed');

    const summary = files.map(({ leagueId }) => ({ leagueId, rows: allRows.filter((r) => r.leagueId === leagueId).length, teams: 0, gameDays: 0, games: 0, normal: 0, tiebreak: 0, forfeit: 0, skipped: 0, conflicts: 0 }));
    const teamMap = {};
    for (const { leagueId } of files) {
      const result = await client.query('SELECT id, name, sort_order AS "sortOrder" FROM team WHERE league_id = $1', [leagueId]);
      const existing = Object.fromEntries(result.rows.map((team) => [team.name, team]));
      for (const [name, sortOrder] of Object.entries(teamOrder)) {
        if (existing[name] && existing[name].sortOrder !== sortOrder) throw new Error(`Team conflict league ${leagueId}: ${name}`);
        if (result.rows.some((team) => team.sortOrder === sortOrder && team.name !== name)) throw new Error(`Team sort_order conflict league ${leagueId}: ${sortOrder}`);
        teamMap[`${leagueId}:${name}`] = existing[name] || null;
      }
    }
    for (const row of allRows) {
      const teams = Object.fromEntries([row.team_a, row.team_b, row.winner].map((name) => [name, teamMap[`${row.leagueId}:${name}`]]));
      const existing = await client.query(`SELECT g.team_a_id, g.team_b_id, g.team_a_score, g.team_b_score, g.winner_team_id, g.result_type, g.status, g.note FROM game g JOIN game_day gd ON gd.id = g.game_day_id WHERE gd.league_id = $1 AND gd.game_date = $2 AND g.game_no = $3`, [row.leagueId, row.date, row.game_no]);
      if (existing.rows.length && !sameGame(existing.rows[0], row, teams)) throw new Error(`Game conflict at ${row.source}`);
      if (existing.rows.length) summary.find((s) => s.leagueId === row.leagueId).skipped += 1;
    }

    await client.query('BEGIN');
    for (const { leagueId } of files) {
      for (const [name, sortOrder] of Object.entries(teamOrder)) {
        const result = await client.query(`INSERT INTO team (league_id, name, sort_order) VALUES ($1, $2, $3) ON CONFLICT (league_id, name) DO NOTHING RETURNING id, name, sort_order AS "sortOrder"`, [leagueId, name, sortOrder]);
        teamMap[`${leagueId}:${name}`] = result.rows[0] || (await client.query('SELECT id, name, sort_order AS "sortOrder" FROM team WHERE league_id = $1 AND name = $2', [leagueId, name])).rows[0];
      }
      const target = summary.find((s) => s.leagueId === leagueId); target.teams = 3;
    }
    for (const row of allRows) {
      const target = summary.find((s) => s.leagueId === row.leagueId);
      const insertedDay = await client.query(`INSERT INTO game_day (league_id, game_date) VALUES ($1, $2) ON CONFLICT (league_id, game_date) DO NOTHING RETURNING id`, [row.leagueId, row.date]);
      const day = insertedDay.rows[0] ? insertedDay : await client.query('SELECT id FROM game_day WHERE league_id = $1 AND game_date = $2', [row.leagueId, row.date]);
      if (row.game_no === 1) target.gameDays += 1;
      const teams = Object.fromEntries([row.team_a, row.team_b, row.winner].map((name) => [name, teamMap[`${row.leagueId}:${name}`]]));
      const existing = await client.query('SELECT id FROM game WHERE game_day_id = $1 AND game_no = $2', [day.rows[0].id, row.game_no]);
      if (existing.rows.length) continue;
      await client.query(`INSERT INTO game (game_day_id, game_no, team_a_id, team_b_id, team_a_score, team_b_score, status, result_type, winner_team_id, note) VALUES ($1,$2,$3,$4,$5,$6,'COMPLETED',$7,$8,$9)`, [day.rows[0].id, row.game_no, teams[row.team_a].id, teams[row.team_b].id, row.team_a_score, row.team_b_score, row.result_type, teams[row.winner].id, row.note || null]);
      target.games += 1; target[row.result_type.toLowerCase()] += 1;
    }
    await client.query('COMMIT');
    console.log(JSON.stringify({ summary, totalRows: allRows.length }, null, 2));
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) { /* no transaction to roll back */ }
    console.error(error.message); process.exitCode = 1;
  } finally { client.release(); await pool.end(); }
}

main();

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });
const pool = require('../db');
const { hashPassword, createSessionToken, hashSessionToken } = require('../services/auth');
const { readWinningCombinations, calculateWinningCombinations } = require('../services/winningCombinations');
const base = process.env.COMBINATION_TEST_BASE_URL || 'http://localhost:3000/api';

async function request(url, cookie, expectedStatus = 200) {
  const response = await fetch(base + url, { headers: cookie ? { Cookie: cookie } : {} });
  assert.equal(response.status, expectedStatus, url);
  return response.json();
}

// Independent PostgreSQL aggregation: build subsets per date, then join games.
const verificationSql = `WITH RECURSIVE
  source_games AS (
    SELECT g.*, CASE WHEN g.winner_team_id IN (g.team_a_id,g.team_b_id) THEN g.winner_team_id
      WHEN COALESCE(g.result_type,'NORMAL')='NORMAL' AND g.team_a_score>=0 AND g.team_b_score>=0
      THEN CASE WHEN g.team_a_score>g.team_b_score THEN g.team_a_id WHEN g.team_b_score>g.team_a_score THEN g.team_b_id END
      END AS resolved_winner_id
    FROM game g JOIN game_day gd ON gd.id=g.game_day_id
    WHERE gd.league_id=$1 AND g.status='COMPLETED' AND COALESCE(g.result_type,'NORMAL')<>'FORFEIT'
  ), valid_games AS (
    SELECT id,game_day_id,team_a_id,team_b_id,resolved_winner_id AS winner_team_id
    FROM source_games WHERE resolved_winner_id IS NOT NULL
  ), roster AS (
    SELECT a.game_day_id, a.actual_team_id AS team_id, array_agg(DISTINCT lm.id ORDER BY lm.id) AS ids
    FROM attendance a JOIN game_day gd ON gd.id = a.game_day_id
    JOIN league_member lm ON lm.id = a.league_member_id AND lm.league_id = gd.league_id
    JOIN member m ON m.id = lm.member_id
    WHERE gd.league_id = $1 AND a.status = 'PRESENT' AND a.actual_team_id IS NOT NULL AND m.is_active
    GROUP BY a.game_day_id, a.actual_team_id
  ), subsets AS (
    SELECT game_day_id, team_id, ARRAY[]::bigint[] AS ids, 0::bigint AS last_id FROM roster
    UNION ALL
    SELECT s.game_day_id, s.team_id, s.ids || p.id, p.id
    FROM subsets s JOIN roster r USING (game_day_id, team_id)
    CROSS JOIN LATERAL unnest(r.ids) AS p(id) WHERE p.id > s.last_id
  ), baseline AS (
    SELECT t.id, t.name, t.sort_order, count(g.id)::int AS games,
      count(g.id) FILTER (WHERE g.winner_team_id = t.id)::int AS wins
    FROM team t JOIN valid_games g ON t.id IN (g.team_a_id, g.team_b_id)
    WHERE t.league_id = $1 GROUP BY t.id
  ), totals AS (
    SELECT s.team_id, s.ids, count(DISTINCT g.id)::int AS games,
      count(DISTINCT g.id) FILTER (WHERE g.winner_team_id = s.team_id)::int AS wins
    FROM subsets s JOIN valid_games g ON g.game_day_id = s.game_day_id AND s.team_id IN (g.team_a_id, g.team_b_id)
    WHERE cardinality(s.ids) >= 3 GROUP BY s.team_id, s.ids
  ) SELECT t.team_id::int AS "teamId", b.name AS "teamName", t.ids AS "memberIds",
    t.games AS "gamesPlayed", t.wins, t.games - t.wins AS losses,
    b.games AS "teamGamesPlayed", b.wins AS "teamWins", b.games - b.wins AS "teamLosses",
    round(t.wins * 100.0 / t.games, 1)::float AS "combinationWinRate",
    round(b.wins * 100.0 / b.games, 1)::float AS "teamWinRate",
    round(t.wins * 100.0 / t.games - b.wins * 100.0 / b.games, 1)::float AS "winImpact"
  FROM totals t JOIN baseline b ON b.id = t.team_id
  ORDER BY (t.wins * 100.0 / t.games - b.wins * 100.0 / b.games) DESC,
    (t.wins * 100.0 / t.games) DESC, t.wins DESC, t.games DESC,
    cardinality(t.ids), b.sort_order, array_to_string(t.ids, '-'), t.team_id`;

async function main() {
  const testIds = [];
  try {
    const league = (await pool.query("SELECT id::int, name FROM league WHERE status='ACTIVE' ORDER BY year DESC, quarter DESC LIMIT 1")).rows[0];
    assert.ok(league, '검증할 ACTIVE 리그가 필요합니다.');
    const publicPath = `/leagues/${league.id}/winning-combinations`;
    const adminPath = `/admin/leagues/${league.id}/winning-combinations`;
    const top7 = await request(publicPath);
    assert.deepEqual(top7.teams.map(team => team.items.length), [7, 7, 7]);
    for (const value of ['0', '-1', '8', '100000', '1.5', 'abc', '', '1e0', '1&limit=2']) await request(`${publicPath}?limit=${value}`, null, 400);
    await request('/leagues/0/winning-combinations', null, 400);
    await request('/leagues/9007199254740991/winning-combinations', null, 404);
    await request(adminPath, null, 401);
    const preview = await request(`${publicPath}?limit=1`);
    preview.teams.forEach((team, index) => assert.deepEqual(team.items, top7.teams[index].items.slice(0, 1)));

    // Random temporary test accounts exercise real login and middleware, then are removed.
    const loginId = `[TEST]-combinations-${crypto.randomUUID()}`;
    const password = crypto.randomBytes(24).toString('base64url');
    const passwordHash = await hashPassword(password);
    for (const role of ['ADMIN', 'MEMBER']) {
      const account = (await pool.query('INSERT INTO admin_account(login_id,name,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id', [loginId + role, '[TEST] 필승조합 검증', passwordHash, role])).rows[0];
      testIds.push(account.id);
    }
    const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loginId: loginId + 'ADMIN', password }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const token = createSessionToken();
    await pool.query("INSERT INTO admin_session(admin_account_id,token_hash,expires_at) VALUES($1,$2,CURRENT_TIMESTAMP+INTERVAL '5 minutes')", [testIds[1], hashSessionToken(token)]);
    await request(adminPath, `admin_session=${token}`, 403);
    const top20 = await request(`${adminPath}?limit=20`, cookie);
    await request(`${adminPath}?limit=21`, cookie, 400);
    top20.teams.forEach((team, index) => {
      assert.deepEqual(team.items.slice(0, 7), top7.teams[index].items);
      assert.equal(team.items.length, 20);
    });
    assert.equal(JSON.stringify(top7).includes('"note"'), false);

    const sqlRows = (await pool.query(verificationSql, [league.id])).rows.map(row => ({ ...row, memberIds: row.memberIds.map(Number) }));
    const eligible = sqlRows.filter(row => row.gamesPlayed >= 3);
    const full = await readWinningCombinations(pool, league.id, Number.MAX_SAFE_INTEGER);
    const fullItems = full.teams.flatMap(team => team.items);
    assert.equal(fullItems.length, eligible.length);
    for (const team of full.teams) {
      const expectedItems = eligible.filter(row => row.teamId === team.teamId);
      for (let i = 0; i < expectedItems.length; i += 1) {
        for (const key of Object.keys(expectedItems[i])) assert.deepEqual(team.items[i][key], expectedItems[i][key], `${team.teamName} ${i + 1}위 ${key}`);
        assert.equal(team.items[i].rank, i + 1);
      }
      assert.deepEqual(top20.teams.find(t => t.teamId === team.teamId).items, team.items.slice(0, 20));
    }
    assert.deepEqual(await request(publicPath), top7);
    assert.equal(new Set(fullItems.map(item => item.key)).size, fullItems.length);
    const inactive = (await pool.query('SELECT m.id::int AS "memberId", m.name, lm.id::int AS "leagueMemberId" FROM member m JOIN league_member lm ON lm.member_id=m.id WHERE lm.league_id=$1 AND NOT m.is_active', [league.id])).rows;
    assert.ok(inactive.length > 0);
    for (const item of fullItems) assert.equal(item.members.some(member => inactive.some(row => row.memberId === member.memberId)), false);

    // Read all original rows (including forfeit, inactive, absent), then prove their exclusion does not affect results.
    let raw;
    await readWinningCombinations({ query: async (sql, values) => {
      const expandedSql = sql.replace("AND g.status = 'COMPLETED'", '')
        .replace("AND COALESCE(g.result_type, 'NORMAL') <> 'FORFEIT'", '')
        .replace('AND g.winner_team_id IN (g.team_a_id, g.team_b_id)', '')
        .replace('AND m.is_active = TRUE', '').replace("AND a.status = 'PRESENT' AND a.actual_team_id IS NOT NULL", '');
      const result = await pool.query(expandedSql, values); raw = result.rows[0]; return result;
    } }, league.id, 20);
    assert.deepEqual(calculateWinningCombinations(raw, league.id, 20), top20);
    const legacySeptember = { ...raw, games: raw.games.map(game => [99, 100, 101].includes(game.gameId)
      ? { ...game, winnerTeamId: null, resultType: null } : game) };
    assert.deepEqual(calculateWinningCombinations(legacySeptember, league.id, 20), top20);
    const forfeits = raw.games.filter(game => game.resultType === 'FORFEIT');
    assert.ok(forfeits.length > 0);
    assert.deepEqual(calculateWinningCombinations({ ...raw, games: raw.games.filter(game => game.resultType !== 'FORFEIT') }, league.id, 20), top20);
    const duplicates = (await pool.query(`SELECT a.game_day_id, a.league_member_id, count(*) FROM attendance a
      JOIN game_day gd ON gd.id=a.game_day_id WHERE gd.league_id=$1 GROUP BY a.game_day_id,a.league_member_id HAVING count(*)>1`, [league.id])).rows;
    assert.equal(duplicates.length, 0);
    const baseline = (await pool.query(`SELECT t.id::int AS "teamId",t.name,count(g.id)::int AS games,
      count(g.id) FILTER(WHERE g.winner_team_id=t.id)::int AS wins,
      count(g.id) FILTER(WHERE g.winner_team_id<>t.id)::int AS losses,
      round(count(g.id) FILTER(WHERE g.winner_team_id=t.id)*100.0/NULLIF(count(g.id),0),1)::float AS "winRate"
      FROM team t LEFT JOIN (game g JOIN game_day gd ON gd.id=g.game_day_id)
      ON gd.league_id=t.league_id AND t.id IN(g.team_a_id,g.team_b_id) AND g.status='COMPLETED'
      AND COALESCE(g.result_type,'NORMAL')<>'FORFEIT' AND g.winner_team_id IN(g.team_a_id,g.team_b_id)
      WHERE t.league_id=$1 GROUP BY t.id ORDER BY t.sort_order`, [league.id])).rows;
    const winner = top7.teams.find(team => team.teamName === '컬러').items[0];
    const presentDates = (await pool.query(`SELECT gd.id::int AS "gameDayId",to_char(gd.game_date,'YYYY-MM-DD') AS date,
      a.actual_team_id::int AS "actualTeamId",json_agg(json_build_object('leagueMemberId',lm.id,'name',m.name,'status',a.status,'originalTeamId',lm.team_id) ORDER BY lm.id) AS players
      FROM attendance a JOIN game_day gd ON gd.id=a.game_day_id JOIN league_member lm ON lm.id=a.league_member_id JOIN member m ON m.id=lm.member_id
      WHERE gd.league_id=$1 AND a.actual_team_id=$2 AND a.status='PRESENT' AND lm.id=ANY($3::bigint[])
      GROUP BY gd.id,a.actual_team_id HAVING count(DISTINCT lm.id)=$4 ORDER BY gd.game_date`, [league.id, winner.teamId, winner.memberIds, winner.memberCount])).rows;
    const winnerGames = (await pool.query(`SELECT g.id::int AS "gameId",to_char(gd.game_date,'YYYY-MM-DD') AS date,g.game_no AS "gameNo",
      g.team_a_id::int AS "teamAId",g.team_b_id::int AS "teamBId",g.winner_team_id::int AS "winnerTeamId",
      CASE WHEN g.winner_team_id=$2 THEN '승' ELSE '패' END AS result
      FROM game g JOIN game_day gd ON gd.id=g.game_day_id WHERE gd.id=ANY($1::bigint[]) AND $2 IN(g.team_a_id,g.team_b_id)
      AND g.status='COMPLETED' AND COALESCE(g.result_type,'NORMAL')<>'FORFEIT' AND g.winner_team_id IN(g.team_a_id,g.team_b_id)
      ORDER BY gd.game_date,g.game_no`, [presentDates.map(row => row.gameDayId), winner.teamId])).rows;
    assert.equal(winnerGames.length, winner.gamesPlayed);
    assert.equal(winnerGames.filter(row => row.result === '승').length, winner.wins);
    const moved = (await pool.query(`SELECT count(*)::int AS count FROM attendance a JOIN league_member lm ON lm.id=a.league_member_id
      JOIN member m ON m.id=lm.member_id WHERE lm.league_id=$1 AND a.status='PRESENT' AND m.is_active
      AND a.actual_team_id IS NOT NULL AND a.actual_team_id IS DISTINCT FROM lm.team_id`, [league.id])).rows[0].count;
    const regression = {};
    for (const url of ['/health', '/leagues', `/leagues/${league.id}`, `/leagues/${league.id}/games`, `/leagues/${league.id}/standings`, `/leagues/${league.id}/win-impact`, `/leagues/${league.id}/participants`, `/leagues/${league.id}/attendance/rates`, `/admin/leagues/${league.id}/games`, `/admin/leagues/${league.id}/attendance/dates`]) {
      await request(url, url.startsWith('/admin') ? cookie : null); regression[url] = 200;
    }
    const report = { league, baseline, top7, top20Counts: top20.teams.map(team => ({ team: team.teamName, count: team.items.length })), allEligibleCount: eligible.length,
      excludedSmallSampleCount: sqlRows.length - eligible.length, twoWinsTwoGames: sqlRows.filter(row => row.gamesPlayed === 2 && row.wins === 2).length,
      inactive, movedAttendanceCount: moved, forfeits, invalidCompletedGames: raw.games.filter(game => game.status === 'COMPLETED' && game.winnerTeamId == null),
      presentDates, winnerGames, regression, duplicateAttendanceCount: duplicates.length };
    fs.mkdirSync(path.join(__dirname, '../../logs'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, '../../logs/winning-combinations-team-verification.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ...report, top7: top7.teams.flatMap(team => team.items).map(item => ({ rank: item.rank, team: item.teamName, members: item.members.map(member => member.name).join(' · '), games: item.gamesPlayed, wins: item.wins, winRate: item.combinationWinRate, impact: item.winImpact })) }, null, 2));
  } finally {
    if (testIds.length) await pool.query('DELETE FROM admin_account WHERE id=ANY($1::bigint[])', [testIds]);
    await pool.end();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

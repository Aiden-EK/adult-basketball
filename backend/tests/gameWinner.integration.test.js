const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true });
const pool = require('../db');
const { hashPassword } = require('../services/auth');
const base = process.env.COMBINATION_TEST_BASE_URL || 'http://localhost:3000/api';

async function main() {
  let accountId, leagueId;
  try {
    const loginId = `[TEST]-winner-${crypto.randomUUID()}`;
    const password = crypto.randomBytes(24).toString('base64url');
    accountId = (await pool.query("INSERT INTO admin_account(login_id,name,password_hash,role) VALUES($1,'[TEST] 승리팀 저장',$2,'ADMIN') RETURNING id", [loginId, await hashPassword(password)])).rows[0].id;
    const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loginId, password }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    leagueId = (await pool.query("INSERT INTO league(year,quarter,name) VALUES(2096,4,$1) RETURNING id", [loginId])).rows[0].id;
    const teamA = Number((await pool.query("INSERT INTO team(league_id,name,sort_order) VALUES($1,'[TEST] A',1) RETURNING id", [leagueId])).rows[0].id);
    const teamB = Number((await pool.query("INSERT INTO team(league_id,name,sort_order) VALUES($1,'[TEST] B',2) RETURNING id", [leagueId])).rows[0].id);
    async function save(method, suffix, body, status = 200) {
      const response = await fetch(`${base}/admin/leagues/${leagueId}/games${suffix}`, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      assert.equal(response.status, status, `${method} ${suffix}`);
      return response.json();
    }
    const normal = { homeTeamId: teamA, awayTeamId: teamB, homeScore: 36, awayScore: 50, status: 'COMPLETED', resultType: 'NORMAL', winnerTeamId: null };
    const created = await save('POST', '', normal, 201);
    async function check(gameId, winner, type, scoreA, scoreB, status = 'COMPLETED') {
      const row = (await pool.query('SELECT * FROM game WHERE id=$1', [gameId])).rows[0];
      assert.equal(row.winner_team_id == null ? null : Number(row.winner_team_id), winner);
      assert.equal(row.result_type, type);
      assert.equal(row.team_a_score, scoreA);
      assert.equal(row.team_b_score, scoreB);
      assert.equal(row.status, status);
    }
    await check(created.gameId, teamB, 'NORMAL', 36, 50);
    await save('PATCH', `/${created.gameId}`, { homeScore: 50, awayScore: 31, winnerTeamId: teamB });
    await check(created.gameId, teamA, 'NORMAL', 50, 31);
    // Legacy NULL winner/result must be healed when saved without an explicit winner.
    await pool.query('UPDATE game SET winner_team_id=NULL,result_type=NULL WHERE id=$1', [created.gameId]);
    await save('PATCH', `/${created.gameId}`, { homeScore: 25, awayScore: 30 });
    await check(created.gameId, teamB, 'NORMAL', 25, 30);
    await save('PATCH', `/${created.gameId}`, { homeScore: 30, awayScore: 30, winnerTeamId: null }, 400);
    await save('PATCH', `/${created.gameId}`, { homeScore: 30, awayScore: 30, resultType: 'TIEBREAK', winnerTeamId: teamA });
    await check(created.gameId, teamA, 'TIEBREAK', 30, 30);
    await save('PATCH', `/${created.gameId}`, { homeScore: 0, awayScore: 0, resultType: 'FORFEIT', winnerTeamId: teamB });
    await check(created.gameId, teamB, 'FORFEIT', 0, 0);
    await save('PATCH', `/${created.gameId}`, { status: 'SCHEDULED', homeScore: 50, awayScore: 30, winnerTeamId: teamB, resultType: 'NORMAL' });
    await check(created.gameId, null, null, null, null, 'SCHEDULED');
    await save('PATCH', `/${created.gameId}`, { status: 'COMPLETED', homeScore: 50, awayScore: 31 });
    await check(created.gameId, teamA, 'NORMAL', 50, 31);
    const scheduled = await save('POST', '', { ...normal, status: 'SCHEDULED' }, 201);
    await check(scheduled.gameId, null, null, null, null, 'SCHEDULED');
    await save('POST', '', { ...normal, homeScore: null }, 400);
    await save('POST', '', { ...normal, resultType: 'FORFEIT' }, 400);
    await save('POST', '', { ...normal, resultType: 'TIEBREAK' }, 400);
    await save('POST', '', { ...normal, homeScore: 50 }, 400);
    await save('POST', '', { ...normal, resultType: 'BAD' }, 400);
    console.log('승리팀 생성/수정/기존 NULL/점수 역전/동점/몰수/예정 전환 저장 통합 테스트 통과');
  } finally {
    if (leagueId) {
      await pool.query('DELETE FROM game WHERE game_day_id IN(SELECT id FROM game_day WHERE league_id=$1)', [leagueId]);
      await pool.query('DELETE FROM game_day WHERE league_id=$1', [leagueId]);
      await pool.query('DELETE FROM team WHERE league_id=$1', [leagueId]);
      await pool.query('DELETE FROM league WHERE id=$1', [leagueId]);
    }
    if (accountId) await pool.query('DELETE FROM admin_account WHERE id=$1', [accountId]);
    await pool.end();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

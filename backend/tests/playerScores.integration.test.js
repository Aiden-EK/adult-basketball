const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { Pool } = require('pg');
const { PlayerScoreError, readPlayerScores, replacePlayerScores, validateScores } = require('../services/playerScores');

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.POSTGRES_PORT || 5432),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});

async function expectPlayerScoreError(action, status) {
  await assert.rejects(action, error => error instanceof PlayerScoreError && error.status === status);
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      INSERT INTO league (id, year, quarter, name) VALUES (91300, 2098, 4, '[TEST] 개인 득점 리그'), (91390, 2097, 4, '[TEST] 다른 리그');
      INSERT INTO team (id, league_id, name, sort_order) VALUES
        (91301, 91300, '[TEST] A팀', 1), (91302, 91300, '[TEST] B팀', 2), (91303, 91300, '[TEST] C팀', 3),
        (91391, 91390, '[TEST] 다른 팀', 1);
      INSERT INTO member (id, name) VALUES
        (91301, '[TEST] A선수'), (91302, '[TEST] B선수'), (91303, '[TEST] C선수'), (91391, '[TEST] 다른 리그 선수');
      INSERT INTO league_member (id, league_id, member_id, team_id) VALUES
        (91301, 91300, 91301, 91301), (91302, 91300, 91302, 91302),
        (91303, 91300, 91303, 91303), (91391, 91390, 91391, 91391);
      INSERT INTO game_day (id, league_id, game_date) VALUES (91301, 91300, '2098-10-01');
      INSERT INTO game (id, game_day_id, game_no, team_a_id, team_b_id, team_a_score, team_b_score, status, result_type, winner_team_id) VALUES
        (91301, 91301, 1, 91301, 91302, 52, 45, 'COMPLETED', 'NORMAL', 91301),
        (91302, 91301, 2, 91301, 91302, 40, 40, 'COMPLETED', 'TIEBREAK', 91302),
        (91303, 91301, 3, 91301, 91302, 0, 0, 'COMPLETED', 'FORFEIT', 91301),
        (91304, 91301, 4, 91301, 91302, NULL, NULL, 'SCHEDULED', NULL, NULL);
    `);

    await replacePlayerScores(client, 91301, [{ leagueMemberId: 91301, points: 52 }, { leagueMemberId: 91302, points: 45 }]);
    assert.equal((await client.query('SELECT COUNT(*)::int AS count FROM game_player_score WHERE game_id=91301')).rows[0].count, 2, '1. 완료 경기 저장');

    await replacePlayerScores(client, 91301, [{ leagueMemberId: 91301, points: 50 }, { leagueMemberId: 91302, points: 45 }]);
    assert.equal((await client.query('SELECT points FROM game_player_score WHERE game_id=91301 AND league_member_id=91301')).rows[0].points, 50, '2. 기존 득점 수정');

    assert.throws(() => validateScores([{ leagueMemberId: 1, points: 1 }, { leagueMemberId: 1, points: 2 }]), /중복/, '3. 중복 선수 거부');
    assert.throws(() => validateScores([{ leagueMemberId: 1, points: -1 }]), /0 이상의 정수/, '4. 음수 거부');
    assert.throws(() => validateScores([{ leagueMemberId: 1, points: 1.5 }]), /0 이상의 정수/, '5. 소수 거부');

    await expectPlayerScoreError(() => replacePlayerScores(client, 91301, [{ leagueMemberId: 91391, points: 1 }]), 400);
    await expectPlayerScoreError(() => replacePlayerScores(client, 91301, [{ leagueMemberId: 91303, points: 1 }]), 400);
    await expectPlayerScoreError(() => replacePlayerScores(client, 91304, [{ leagueMemberId: 91301, points: 1 }]), 409);

    await replacePlayerScores(client, 91301, [{ leagueMemberId: 91301, points: 52 }, { leagueMemberId: 91302, points: 45 }]);
    const normal = await readPlayerScores(client, 91301);
    assert.ok(normal.teams.every(team => team.matches && team.consistencyRequired), '9. NORMAL 합계 비교');

    await replacePlayerScores(client, 91302, [{ leagueMemberId: 91301, points: 40 }, { leagueMemberId: 91302, points: 40 }]);
    const tiebreak = await readPlayerScores(client, 91302);
    assert.ok(tiebreak.teams.every(team => team.points === 40 && team.matches), '10. TIEBREAK 기록 점수 비교');

    await replacePlayerScores(client, 91303, []);
    const forfeit = await readPlayerScores(client, 91303);
    assert.ok(forfeit.teams.every(team => team.points === 0 && !team.consistencyRequired), '11. FORFEIT 빈 기록 허용');

    const beforeRollbackTest = (await client.query('SELECT league_member_id, points FROM game_player_score WHERE game_id=91301 ORDER BY league_member_id')).rows;
    await expectPlayerScoreError(() => replacePlayerScores(client, 91301, [{ leagueMemberId: 91301, points: 10 }, { leagueMemberId: 91303, points: 1 }]), 400);
    const afterRollbackTest = (await client.query('SELECT league_member_id, points FROM game_player_score WHERE game_id=91301 ORDER BY league_member_id')).rows;
    assert.deepEqual(afterRollbackTest, beforeRollbackTest, '12. 잘못된 항목이 있으면 기존 기록 보존');

    await replacePlayerScores(client, 91301, [{ leagueMemberId: 91301, points: 0 }, { leagueMemberId: 91302, points: 45 }]);
    assert.equal((await client.query('SELECT COUNT(*)::int AS count FROM game_player_score WHERE game_id=91301 AND league_member_id=91301')).rows[0].count, 0, '13. 0점 row 생략');

    await client.query('DELETE FROM game_player_score WHERE game_id=91301');
    const empty = await readPlayerScores(client, 91301);
    assert.ok(empty.teams.every(team => team.players.every(player => !player.hasScore) && team.points === 0), '14. 개인득점 없는 완료 경기 조회');

    console.log('개인 득점 통합 테스트 14개 통과');
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

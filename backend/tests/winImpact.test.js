const assert = require('node:assert/strict');
const { calculateWinImpact, readWinImpact } = require('../services/winImpact');

const rows = [];
for (let gameId = 1; gameId <= 9; gameId += 1) {
  const winnerTeamId = gameId <= 4 ? 1 : 2;
  for (const player of [{ leagueMemberId: 10, memberId: 100, name: '비교회원' }, { leagueMemberId: 11, memberId: 101, name: '전경기회원' }]) {
    const absent = player.leagueMemberId === 10 && gameId > 6;
    rows.push({ ...player, gameId, resultType: gameId === 9 ? 'FORFEIT' : 'NORMAL', teamAId: 1, teamAName: '팀1', teamBId: 2, teamBName: '팀2', teamAScore: winnerTeamId === 1 ? 50 : 40, teamBScore: winnerTeamId === 2 ? 50 : 40, winnerTeamId, attendanceRecorded: true, attendanceStatus: absent ? 'ABSENT' : 'PRESENT', actualTeamId: absent ? null : 1 });
  }
}
rows.push({ leagueMemberId: 10, memberId: 100, name: '비교회원', gameId: 10, resultType: 'TIEBREAK', teamAId: 1, teamAName: '팀1', teamBId: 2, teamBName: '팀2', teamAScore: 50, teamBScore: 50, winnerTeamId: null, attendanceRecorded: true, attendanceStatus: 'PRESENT', actualTeamId: 1 });

const calculated = calculateWinImpact(rows, 7);
const compared = calculated.players.find(player => player.leagueMemberId === 10);
assert.equal(compared.games, 6);
assert.equal(compared.wins, 4);
assert.equal(compared.gamesWithoutPlayer, 2);
assert.equal(compared.winRate, 66.7);
assert.equal(compared.winRateWithoutPlayer, 0);
assert.equal(compared.winImpact, 66.7);
assert.equal(compared.rankingEligible, true);
const attendedAll = calculated.players.find(player => player.leagueMemberId === 11);
assert.equal(attendedAll.games, 8);
assert.equal(attendedAll.gamesWithoutPlayer, 0);
assert.equal(attendedAll.allGamesAttended, true);
assert.equal(attendedAll.winImpact, null);
assert.equal(attendedAll.rankingEligible, false);

async function run() {
  let queryText = '';
  const fakePool = {
    async query(sql) {
      queryText = sql;
      return { rows: [] };
    }
  };

  const result = await readWinImpact(fakePool, 7);
  assert.match(queryText, /COALESCE\(g\.result_type, 'NORMAL'\) <> 'FORFEIT'/);
  assert.deepEqual(result, { leagueId: 7, minimumGames: 6, players: [] });
  console.log('win impact tests passed');
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});

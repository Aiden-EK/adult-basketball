const assert = require('node:assert/strict');
const { generateCombinations, calculateWinningCombinations, readWinningCombinations } = require('../services/winningCombinations');

const teams = [1, 2, 3].map(teamId => ({ teamId, teamName: `팀${teamId}`, teamSortOrder: teamId }));
const game = (id, winnerTeamId = 1, extra = {}) => ({ gameId: id, gameDayId: id, teamAId: 1, teamBId: 2, winnerTeamId, status: 'COMPLETED', resultType: 'NORMAL', ...extra });
const attendance = (days, ids = [13, 16, 21], actualTeamId = 1) => days.flatMap(gameDayId => ids.map(leagueMemberId => ({ gameDayId, leagueMemberId, memberId: leagueMemberId + 100, name: '동명이인', grade: leagueMemberId === 21 ? 'GUEST' : 'REGULAR', isActive: true, status: 'PRESENT', actualTeamId })));
const calculate = (games, rows, limit = 10000) => calculateWinningCombinations({ teams, games, attendance: rows }, 99, limit);

const subsets = [...generateCombinations([1, 2, 3, 4, 5])];
assert.equal(subsets.length, 16);
assert.equal(new Set(subsets.map(ids => ids.join('-'))).size, 16);
assert.equal([...generateCombinations([1, 2])].length, 0);
assert.equal([...generateCombinations(Array.from({ length: 8 }, (_, i) => i))].length, 219);

// Six joint games: 5 wins, 1 loss; all 20 team games: 10 wins, 10 losses.
const games = Array.from({ length: 20 }, (_, i) => game(i + 1, i < 5 || (i >= 6 && i < 11) ? 1 : 2));
const result = calculate(games, attendance([1, 2, 3, 4, 5, 6]));
const top = result.items[0];
assert.equal(top.key, '1:13-16-21');
assert.equal(top.gamesPlayed, 6);
assert.equal(top.wins, 5);
assert.equal(top.losses, 1);
assert.equal(top.combinationWinRate, 83.3);
assert.equal(top.teamGamesPlayed, 20);
assert.equal(top.teamWins, 10);
assert.equal(top.teamLosses, 10);
assert.equal(top.teamWinRate, 50);
assert.equal(top.winImpact, 33.3);
assert.equal(top.members[2].grade, 'GUEST');

const rows = attendance([1, 2, 3, 4, 5, 6]);
assert.deepEqual(calculate([...games, ...games], [...rows, ...rows].reverse()), result);
assert.equal(calculate(games, attendance([1, 2])).items.length, 0);
assert.equal(calculate(games, attendance([1, 2, 3])).items.length, 1);
assert.equal(calculate(games, rows.map(row => ({ ...row, isActive: row.leagueMemberId !== 13 }))).items.length, 0);
assert.equal(calculate(games, rows.map(row => ({ ...row, status: row.leagueMemberId === 13 ? 'ABSENT' : 'PRESENT' }))).items.length, 0);
assert.equal(calculate(games, rows.map(row => ({ ...row, actualTeamId: row.leagueMemberId === 13 ? null : 1 }))).items.length, 0);
const invalidGames = [game(21, 1, { resultType: 'FORFEIT' }), game(22, null), game(23, 1, { status: 'SCHEDULED' }), game(24, 999)];
assert.deepEqual(calculate([...games, ...invalidGames], [...rows, ...attendance([21, 22, 23, 24])]), result);
assert.equal(calculate([game(1), game(2), game(3, 1, { resultType: null })], attendance([1, 2, 3])).items[0].wins, 3);
assert.equal(calculate([game(1), game(2), game(3, 1, { resultType: 'TIEBREAK' })], attendance([1, 2, 3])).items[0].wins, 3);

// One date maps to each of the team's games, and actual team overrides original assignment.
const sameDay = [game(1, 2, { gameDayId: 10 }), game(2, 2, { gameDayId: 10 }), game(3, 1, { gameDayId: 10 })];
const moved = calculate(sameDay, attendance([10], [21, 13, 16], 2).map(row => ({ ...row, teamId: 1 })));
assert.equal(moved.items[0].teamId, 2);
assert.equal(moved.items[0].gamesPlayed, 3);
assert.equal(moved.items[0].wins, 2);
assert.equal(moved.items[0].teamWins, 2);
assert.equal(moved.items[0].winImpact, 0);
const twoTeams = calculate(games, [...rows, ...attendance([7, 8, 9], [13, 16, 21], 2)]);
assert.equal(new Set(twoTeams.items.map(item => item.key)).size, 2);
assert.ok(calculate(games, attendance([12, 13, 14])).items[0].winImpact < 0);

// Lower raw win rate wins when uplift over the team's fixed baseline is greater.
const rankingGames = Array.from({ length: 20 }, (_, i) => game(i + 1, i < 14 ? 1 : 2));
const ranking = calculate(rankingGames, [...attendance([1, 2, 3, 14, 15]), ...attendance([14, 15, 16, 17], [30, 31, 32], 2)]);
assert.equal(ranking.items[0].teamId, 2);
assert.equal(ranking.items[0].combinationWinRate, 75);
assert.equal(ranking.items[1].combinationWinRate, 80);
assert.ok(ranking.items[0].winImpact > ranking.items[1].winImpact);

const allSizes = calculate(sameDay, attendance([10], [1, 2, 3, 4, 5, 6, 7, 8]));
assert.equal(allSizes.items.length, 219);
assert.equal(allSizes.items.at(-1).memberCount, 8);
assert.equal(allSizes.items[0].key, '1:1-2-3');
assert.deepEqual(calculate(sameDay, attendance([10], [8, 7, 6, 5, 4, 3, 2, 1]), 7).items, allSizes.items.slice(0, 7));

async function testQuery() {
  let count = 0;
  await readWinningCombinations({ query: async (sql, params) => {
    count += 1;
    assert.deepEqual(params, [99]);
    assert.match(sql, /COALESCE\(g.result_type, 'NORMAL'\) <> 'FORFEIT'/);
    assert.match(sql, /g.winner_team_id IN/);
    assert.doesNotMatch(sql, /\bnote\b/);
    return { rows: [{ teams: [], games: [], attendance: [] }] };
  } }, 99, 7);
  assert.equal(count, 1);
  console.log('필승조합 계산·출석·표본·중복·정렬·쿼리 테스트 통과');
}
testQuery().catch(error => { console.error(error); process.exitCode = 1; });

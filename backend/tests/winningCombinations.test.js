const assert = require('node:assert/strict');
const { generateCombinations, calculateWinningCombinations, readWinningCombinations } = require('../services/winningCombinations');

const teams = [1, 2, 3].map(teamId => ({ teamId, teamName: `팀${teamId}`, teamSortOrder: teamId }));
const game = (id, winnerTeamId = 1, extra = {}) => ({ gameId: id, gameDayId: id, teamAId: 1, teamBId: 2, winnerTeamId, status: 'COMPLETED', resultType: 'NORMAL', ...extra });
const attendance = (days, ids = [13, 16, 21], actualTeamId = 1) => days.flatMap(gameDayId => ids.map(leagueMemberId => ({ gameDayId, leagueMemberId, memberId: leagueMemberId + 100, name: '동명이인', grade: leagueMemberId === 21 ? 'GUEST' : 'REGULAR', isActive: true, status: 'PRESENT', actualTeamId })));
const calculate = (games, rows, limit = 10000) => {
  const result = calculateWinningCombinations({ teams, games, attendance: rows }, 99, limit);
  return { ...result, items: result.teams.flatMap(team => team.items) };
};

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
assert.equal(ranking.teams[0].items[0].combinationWinRate, 80);
assert.equal(ranking.teams[1].items[0].combinationWinRate, 75);
assert.equal(ranking.teams[0].items[0].rank, 1);
assert.equal(ranking.teams[1].items[0].rank, 1);

const allSizes = calculate(sameDay, attendance([10], [1, 2, 3, 4, 5, 6, 7, 8]));
assert.equal(allSizes.items.length, 1);
assert.equal(allSizes.items[0].memberCount, 8);
assert.equal(allSizes.items[0].key, '1:1-2-3-4-5-6-7-8');
assert.deepEqual(calculate(sameDay, attendance([10], [8, 7, 6, 5, 4, 3, 2, 1]), 7).items, allSizes.items);

// Each team has distinct triple-only dates, proving limit is per team rather than global.
function perTeamFixture(counts) {
  const fixtures = { teams, games: [], attendance: [] };
  let nextId = 1000;
  counts.forEach((count, index) => {
    const teamId = index + 1;
    for (let i = 0; i < count; i += 1) {
      const dayId = nextId++;
      fixtures.attendance.push(...attendance([dayId], [dayId * 3, dayId * 3 + 1, dayId * 3 + 2], teamId));
      for (let match = 0; match < 3; match += 1) fixtures.games.push(game(nextId++, teamId, { gameDayId: dayId, teamAId: teamId, teamBId: teamId % 3 + 1 }));
    }
  });
  return fixtures;
}
assert.deepEqual(calculateWinningCombinations(perTeamFixture([10, 9, 8]), 99, 7).teams.map(team => team.items.length), [7, 7, 7]);
assert.deepEqual(calculateWinningCombinations(perTeamFixture([25, 24, 23]), 99, 20).teams.map(team => team.items.length), [20, 20, 20]);
for (const team of calculateWinningCombinations(perTeamFixture([10, 9, 8]), 99, 7).teams) {
  assert.equal(team.items[0].rank, 1);
  assert.ok(team.items.every(item => item.teamId === team.teamId && item.teamWinRate === team.teamWinRate));
}
assert.equal(calculateWinningCombinations({ teams, games: [], attendance: [] }, 99).teams[0].teamWinRate, null);

const { resolveWinnerTeamId, resolveWinnerForSave } = require('../services/gameWinner');
const legacy = { status: 'COMPLETED', resultType: 'NORMAL', teamAId: 8, teamBId: 9, teamAScore: 36, teamBScore: 50, winnerTeamId: null };
assert.equal(resolveWinnerTeamId(legacy), 9);
assert.equal(resolveWinnerTeamId({ ...legacy, resultType: null }), 9);
assert.equal(resolveWinnerTeamId({ ...legacy, winnerTeamId: 8 }), 8);
assert.equal(resolveWinnerForSave({ ...legacy, winnerTeamId: 8 }).winnerTeamId, 9);
assert.equal(resolveWinnerTeamId({ ...legacy, teamAScore: null }), null);
assert.equal(resolveWinnerTeamId({ ...legacy, teamAScore: 50 }), null);
assert.equal(resolveWinnerTeamId({ ...legacy, resultType: 'FORFEIT' }), null);
assert.equal(resolveWinnerTeamId({ ...legacy, resultType: 'TIEBREAK' }), null);
assert.equal(resolveWinnerTeamId({ ...legacy, status: 'SCHEDULED' }), null);
assert.equal(resolveWinnerTeamId({ ...legacy, resultType: 'FORFEIT', winnerTeamId: 8 }), 8);
const september = [
  { ...legacy, gameId: 99, gameDayId: 182 },
  { ...legacy, gameId: 100, gameDayId: 182, teamBId: 7, teamAScore: 50, teamBScore: 31 },
  { ...legacy, gameId: 101, gameDayId: 182, teamAId: 7, teamAScore: 25, teamBScore: 30 }
];
const septemberResult = calculateWinningCombinations({ teams: [7, 8, 9].map(teamId => ({ teamId, teamSortOrder: teamId })), games: september, attendance: [] }, 7);
assert.deepEqual(septemberResult.teams.map(team => [team.teamId, team.teamGamesPlayed, team.teamWins, team.teamLosses]), [[7, 2, 0, 2], [8, 2, 1, 1], [9, 2, 2, 0]]);

async function testQuery() {
  let count = 0;
  await readWinningCombinations({ query: async (sql, params) => {
    count += 1;
    assert.deepEqual(params, [99]);
    assert.match(sql, /COALESCE\(g.result_type, 'NORMAL'\) <> 'FORFEIT'/);
    assert.match(sql, /g.team_a_score AS "teamAScore"/);
    assert.doesNotMatch(sql, /\bnote\b/);
    return { rows: [{ teams: [], games: [], attendance: [] }] };
  } }, 99, 7);
  assert.equal(count, 1);
  console.log('필승조합 계산·출석·표본·중복·정렬·쿼리 테스트 통과');
}
testQuery().catch(error => { console.error(error); process.exitCode = 1; });

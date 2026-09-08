const assert = require('node:assert/strict');
const { calculateStandings } = require('../services/standings');

const team = (id, name = `팀${id}`) => ({ id, name });
const game = (homeTeamId, awayTeamId, homeScore, awayScore, options = {}) => ({
  homeTeamId,
  awayTeamId,
  homeScore,
  awayScore,
  winnerTeamId: options.winnerTeamId ?? null,
  status: options.status ?? 'COMPLETED',
  gameDate: options.gameDate,
  gameNo: options.gameNo,
  gameId: options.gameId
});
const order = standings => standings.map(row => row.teamId);

{
  const result = calculateStandings([team(1), team(2)], [game(1, 2, 10, 5)]);
  assert.deepEqual(order(result), [1, 2], '승률이 높은 팀이 상위여야 한다');
}

{
  const games = [game(1, 3, 10, 5), game(1, 4, 10, 5), game(1, 5, 5, 10), game(1, 6, 5, 10), game(2, 3, 10, 5), game(2, 4, 5, 10)];
  const result = calculateStandings([1, 2, 3, 4, 5, 6].map(id => team(id)), games);
  assert.ok(result.findIndex(row => row.teamId === 1) < result.findIndex(row => row.teamId === 2), '승률이 같으면 승수가 많은 팀이 상위여야 한다');
}

{
  const games = [game(1, 3, 20, 10), game(1, 4, 5, 10), game(2, 3, 15, 10), game(2, 4, 5, 10)];
  const result = calculateStandings([1, 2, 3, 4].map(id => team(id)), games);
  assert.ok(result.findIndex(row => row.teamId === 1) < result.findIndex(row => row.teamId === 2), '득실차가 높은 팀이 상위여야 한다');
}

{
  const games = [game(1, 3, 20, 10), game(1, 4, 5, 10), game(2, 3, 25, 20), game(2, 4, 10, 5)];
  const result = calculateStandings([1, 2, 3, 4].map(id => team(id)), games);
  assert.ok(result.findIndex(row => row.teamId === 2) < result.findIndex(row => row.teamId === 1), '득실차가 같으면 득점이 높은 팀이 상위여야 한다');
}

{
  const games = [game(1, 2, 10, 9), game(1, 3, 9, 10), game(2, 4, 10, 9)];
  const result = calculateStandings([team(1), team(2), team(3), team(4)], games);
  assert.ok(result.findIndex(row => row.teamId === 1) < result.findIndex(row => row.teamId === 2), '앞 조건이 같으면 상대전적 우세 팀이 상위여야 한다');
  assert.ok(result.find(row => row.teamId === 1).rank < result.find(row => row.teamId === 2).rank, '상대전적 우세는 순위 번호에도 반영해야 한다');
}

{
  const games = [game(1, 2, 10, 5), game(2, 3, 10, 5), game(3, 1, 10, 5)];
  const result = calculateStandings([team(1), team(2), team(3)], games);
  assert.deepEqual(result.map(row => row.rank), [1, 1, 1], '3팀의 상대전적도 같으면 공동순위여야 한다');
}

{
  const result = calculateStandings([team(1, '가'), team(2, '나'), team(3, '다')], []);
  assert.deepEqual(result.map(row => row.rank), [1, 1, 1], '우열이 없으면 공동순위여야 한다');
  assert.ok(result.every(row => row.gamesPlayed === 0), '경기 없는 팀도 0경기로 포함해야 한다');
}

{
  const result = calculateStandings([team(1), team(2)], [game(1, 2, 99, 0, { status: 'SCHEDULED' })]);
  assert.ok(result.every(row => row.gamesPlayed === 0), '예정 경기는 제외해야 한다');
}

{
  const result = calculateStandings([team(1), team(2)], [game(1, 99, 99, 0)]);
  assert.ok(result.every(row => row.gamesPlayed === 0), '리그에 속하지 않은 팀의 경기는 제외해야 한다');
}

{
  const result = calculateStandings([team(1), team(2)], [game(1, 2, 0, 0)]);
  assert.equal(result[0].gamesPlayed, 1, '0점 완료 경기도 경기수와 득실에 반영해야 한다');
  assert.equal(result[0].wins, 0, '승리팀이 없는 동점은 승패에서 제외해야 한다');
  assert.equal(result[0].losses, 0, '승리팀이 없는 동점은 승패에서 제외해야 한다');
}

{
  const result = calculateStandings([team(1), team(2)], [game(1, 2, 40, 40, { winnerTeamId: 2 })]);
  assert.equal(result[0].teamId, 2, '동점 후 승부결정은 확정 승리팀을 사용해야 한다');
  assert.equal(result[0].wins, 1, '확정 승리팀의 승수를 반영해야 한다');
}

{
  const games = [
    game(1, 2, 10, 5, { gameDate: '2026-07-01', gameNo: 1 }),
    game(2, 1, 5, 10, { gameDate: '2026-07-08', gameNo: 1 }),
    game(1, 2, 5, 10, { gameDate: '2026-07-15', gameNo: 1 }),
    game(1, 2, 10, 5, { gameDate: '2026-07-22', gameNo: 1 })
  ];
  const result = calculateStandings([team(1), team(2)], games);
  assert.equal(result.find(row => row.teamId === 1).currentWinStreak, 1, '최근 경기부터 현재 연승을 계산해야 한다');
}

{
  const games = [game(1, 2, 10, 5), game(2, 1, 10, 5), game(1, 2, 10, 5)];
  const result = calculateStandings([team(1, '블랙'), team(2, '화이트')], games);
  const record = result.find(row => row.teamId === 1).headToHead[0];
  assert.deepEqual(record, { opponentTeamId: 2, opponentTeamName: '화이트', wins: 2, losses: 1 }, '화면용 상대전적을 경기 결과로 계산해야 한다');
}

console.log('순위 계산 테스트 13개 통과');

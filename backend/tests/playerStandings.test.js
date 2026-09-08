const assert = require('node:assert/strict');
const { calculatePlayerStandings } = require('../services/playerStandings');
const row = (id, name, points, games) => ({ leagueMemberId: id, memberId: id, memberName: name, teamId: id, teamName: '팀', totalPoints: points, gamesScored: games });
const result = calculatePlayerStandings([row(1, '홍길동', 120, 8), row(2, '김철수', 110, 2), row(3, '이영희', 110, 8), row(4, '박민수', 95, 1), row(5, '최영수', 0, 0)]);
assert.deepEqual(result.map(p => p.rank), [1, 2, 2, 4, 5]);
assert.equal(result[1].averagePoints, 55); assert.equal(result[2].averagePoints, 13.8);
assert.equal(calculatePlayerStandings([row(1, 'A', 10, 1), row(2, 'B', 20, 10)])[0].memberName, 'B');
console.log('개인 득점 순위 단위 테스트 통과');

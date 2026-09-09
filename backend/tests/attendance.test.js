const assert = require('node:assert/strict');
const { validDate } = require('../routes/leagueAttendance');
const { validAttendanceItem } = require('../routes/adminAttendance');

assert.equal(validDate('2026-09-02'), '2026-09-02');
assert.equal(validDate('2026-02-29'), null);
assert.equal(validDate('2026-13-01'), null);
assert.equal(validDate('2026-9-2'), null);
assert.equal(validDate('not-a-date'), null);

assert.equal(validAttendanceItem({ leagueMemberId: 17, status: 'PRESENT', actualTeamId: 8 }), true);
assert.equal(validAttendanceItem({ leagueMemberId: 17, status: 'PRESENT', actualTeamId: null }), false);
assert.equal(validAttendanceItem({ leagueMemberId: 17, status: 'ABSENT', actualTeamId: null }), true);
assert.equal(validAttendanceItem({ leagueMemberId: 17, status: 'ABSENT', actualTeamId: 8 }), false);
assert.equal(validAttendanceItem({ leagueMemberId: 0, status: 'ABSENT', actualTeamId: null }), false);

console.log('attendance tests passed');

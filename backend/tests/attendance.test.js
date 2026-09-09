const assert = require('node:assert/strict');
const { validDate } = require('../routes/leagueAttendance');

assert.equal(validDate('2026-09-02'), '2026-09-02');
assert.equal(validDate('2026-02-29'), null);
assert.equal(validDate('2026-13-01'), null);
assert.equal(validDate('2026-9-2'), null);
assert.equal(validDate('not-a-date'), null);

console.log('attendance tests passed');

const assert = require('node:assert/strict');
const { readWinImpact } = require('../services/winImpact');

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

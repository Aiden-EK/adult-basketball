function round(value) {
  return value === null || value === undefined || !Number.isFinite(value) ? null : Math.round(value * 10) / 10;
}

function rate(wins, games) {
  return games > 0 ? round((wins / games) * 100) : null;
}

function calculateWinImpact(rows, leagueId, minimumGames = 6) {
  const players = new Map();
  for (const row of rows) {
    const playerId = Number(row.leagueMemberId);
    if (!players.has(playerId)) players.set(playerId, { leagueMemberId: playerId, memberId: Number(row.memberId), name: row.name, teams: new Map() });
    const player = players.get(playerId);
    const gameTeamIds = [Number(row.teamAId), Number(row.teamBId)];
    const actualTeamId = row.actualTeamId == null ? null : Number(row.actualTeamId);
    const present = row.attendanceStatus === 'PRESENT' && actualTeamId !== null;

    for (const teamId of gameTeamIds) {
      const key = `${teamId}`;
      if (!player.teams.has(key)) player.teams.set(key, { teamId, teamName: row[teamId === Number(row.teamAId) ? 'teamAName' : 'teamBName'], games: 0, wins: 0, gamesWithoutPlayer: 0, winsWithoutPlayer: 0 });
      const team = player.teams.get(key);
      const won = Number(row.winnerTeamId) === teamId;
      const participated = present && actualTeamId === teamId;
      if (participated) {
        team.games += 1;
        if (won) team.wins += 1;
      } else {
        team.gamesWithoutPlayer += 1;
        if (won) team.winsWithoutPlayer += 1;
      }
    }
  }

  const result = [...players.values()].map(player => {
    const teams = [...player.teams.values()].filter(team => team.games > 0).map(team => {
      const winRate = rate(team.wins, team.games);
      const withoutRate = rate(team.winsWithoutPlayer, team.gamesWithoutPlayer);
      return { ...team, losses: team.games - team.wins, winRate, winRateWithoutPlayer: withoutRate, winImpact: winRate !== null && withoutRate !== null ? round(winRate - withoutRate) : null };
    });
    const games = teams.reduce((sum, team) => sum + team.games, 0);
    const wins = teams.reduce((sum, team) => sum + team.wins, 0);
    const weightedBaseline = teams.reduce((sum, team) => sum + (team.winImpact === null ? 0 : (team.winRateWithoutPlayer * team.games)), 0);
    const comparableGames = teams.filter(team => team.winImpact !== null).reduce((sum, team) => sum + team.games, 0);
    const weightedBaselineWinRate = comparableGames > 0 ? round(weightedBaseline / comparableGames) : null;
    const winImpact = weightedBaselineWinRate === null ? null : round((wins / games) * 100 - weightedBaselineWinRate);
    return { leagueId: Number(leagueId), leagueMemberId: player.leagueMemberId, memberId: player.memberId, name: player.name, games, wins, losses: games - wins, winRate: rate(wins, games), weightedBaselineWinRate, winImpact, rankingEligible: games >= minimumGames && winImpact !== null, teams };
  });
  result.sort((a, b) => Number(b.rankingEligible) - Number(a.rankingEligible) || (b.winImpact ?? -Infinity) - (a.winImpact ?? -Infinity) || b.games - a.games || a.name.localeCompare(b.name, 'ko'));
  result.forEach((player, index) => { player.rank = player.rankingEligible ? result.filter(item => item.rankingEligible && (item.winImpact ?? -Infinity) > (player.winImpact ?? -Infinity)).length + 1 : null; });
  return { leagueId: Number(leagueId), minimumGames, players: result };
}

async function readWinImpact(pool, leagueId) {
  const result = await pool.query(`
    SELECT lm.id AS "leagueMemberId", lm.member_id AS "memberId", m.name,
      g.team_a_id AS "teamAId", ta.name AS "teamAName", g.team_b_id AS "teamBId", tb.name AS "teamBName",
      g.winner_team_id AS "winnerTeamId", a.status AS "attendanceStatus", a.actual_team_id AS "actualTeamId"
    FROM league_member lm
    JOIN member m ON m.id = lm.member_id AND m.is_active = TRUE
    CROSS JOIN (SELECT g.id, gd.id AS game_day_id, g.team_a_id, g.team_b_id, g.winner_team_id, gd.game_date
      FROM game g JOIN game_day gd ON gd.id = g.game_day_id
      WHERE gd.league_id = $1 AND g.status = 'COMPLETED') g
    JOIN team ta ON ta.id = g.team_a_id
    JOIN team tb ON tb.id = g.team_b_id
    LEFT JOIN attendance a ON a.league_member_id = lm.id AND a.game_day_id = g.game_day_id
    WHERE lm.league_id = $1`, [leagueId]);
  return calculateWinImpact(result.rows, leagueId);
}

module.exports = { calculateWinImpact, readWinImpact };

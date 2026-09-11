function round(value) {
  return value === null || value === undefined || !Number.isFinite(value) ? null : Math.round(value * 10) / 10;
}

function rate(wins, games) {
  return games > 0 ? round((wins / games) * 100) : null;
}

function winnerId(game) {
  if (game.winnerTeamId === game.teamAId || game.winnerTeamId === game.teamBId) return game.winnerTeamId;
  if (game.teamAScore !== null && game.teamBScore !== null) {
    if (Number(game.teamAScore) > Number(game.teamBScore)) return game.teamAId;
    if (Number(game.teamBScore) > Number(game.teamAScore)) return game.teamBId;
  }
  return null;
}

function calculateWinImpact(rows, leagueId, minimumGames = 6) {
  const gamesById = new Map();
  for (const row of rows) {
    const gameId = Number(row.gameId);
    if (!gamesById.has(gameId)) gamesById.set(gameId, { teamAId: Number(row.teamAId), teamBId: Number(row.teamBId), teamAScore: row.teamAScore == null ? null : Number(row.teamAScore), teamBScore: row.teamBScore == null ? null : Number(row.teamBScore), winnerTeamId: row.winnerTeamId == null ? null : Number(row.winnerTeamId) });
  }
  const teamStats = new Map();
  for (const game of gamesById.values()) {
    const gameWinnerId = winnerId(game);
    for (const teamId of [game.teamAId, game.teamBId]) {
      if (!teamStats.has(teamId)) teamStats.set(teamId, { games: 0, wins: 0 });
      const stats = teamStats.get(teamId);
      stats.games += 1;
      if (gameWinnerId === teamId) stats.wins += 1;
    }
  }
  const players = new Map();
  for (const row of rows) {
    const playerId = Number(row.leagueMemberId);
    if (!players.has(playerId)) players.set(playerId, { leagueMemberId: playerId, memberId: Number(row.memberId), name: row.name, teams: new Map() });
    const player = players.get(playerId);
    const gameTeamIds = [Number(row.teamAId), Number(row.teamBId)];
    const actualTeamId = row.actualTeamId == null ? null : Number(row.actualTeamId);
    const attendanceRecorded = row.attendanceRecorded === true;
    const present = row.attendanceStatus === 'PRESENT' && actualTeamId !== null;

    for (const teamId of gameTeamIds) {
      const key = `${teamId}`;
      if (!player.teams.has(key)) player.teams.set(key, { teamId, teamName: row[teamId === Number(row.teamAId) ? 'teamAName' : 'teamBName'], games: 0, wins: 0 });
      const team = player.teams.get(key);
      const won = winnerId({ teamAId: Number(row.teamAId), teamBId: Number(row.teamBId), teamAScore: row.teamAScore == null ? null : Number(row.teamAScore), teamBScore: row.teamBScore == null ? null : Number(row.teamBScore), winnerTeamId: row.winnerTeamId == null ? null : Number(row.winnerTeamId) }) === teamId;
      const participated = present && actualTeamId === teamId;
      if (!attendanceRecorded) continue;
      if (participated) {
        team.games += 1;
        if (won) team.wins += 1;
      }
    }
  }

  const result = [...players.values()].map(player => {
    const teams = [...player.teams.values()].filter(team => team.games > 0).map(team => {
      const winRate = rate(team.wins, team.games);
      const overallTeamStats = teamStats.get(team.teamId);
      const teamAverageWinRate = overallTeamStats ? rate(overallTeamStats.wins, overallTeamStats.games) : null;
      return {
        teamId: team.teamId,
        teamName: team.teamName,
        teamGames: overallTeamStats?.games || 0,
        teamWins: overallTeamStats?.wins || 0,
        teamLosses: overallTeamStats ? overallTeamStats.games - overallTeamStats.wins : 0,
        teamWinRate: teamAverageWinRate,
        participatedGames: team.games,
        participatedWins: team.wins,
        participatedLosses: team.games - team.wins,
        participatedWinRate: winRate,
        teamAverageWinRate,
        winImpact: winRate !== null && teamAverageWinRate !== null ? round(winRate - teamAverageWinRate) : null
      };
    });
    const games = teams.reduce((sum, team) => sum + team.participatedGames, 0);
    const wins = teams.reduce((sum, team) => sum + team.participatedWins, 0);
    const weightedTeamAverage = teams.reduce((sum, team) => sum + (team.teamAverageWinRate === null ? 0 : (team.teamAverageWinRate * team.participatedGames)), 0);
    const comparableGames = teams.filter(team => team.teamAverageWinRate !== null).reduce((sum, team) => sum + team.participatedGames, 0);
    const teamAverageWinRate = comparableGames > 0 ? round(weightedTeamAverage / comparableGames) : null;
    const winImpact = teamAverageWinRate === null ? null : round((wins / games) * 100 - teamAverageWinRate);
    return { leagueId: Number(leagueId), leagueMemberId: player.leagueMemberId, memberId: player.memberId, name: player.name, games, wins, losses: games - wins, participationWinRate: rate(wins, games), winRate: rate(wins, games), teamAverageWinRate, winImpact, rankingEligible: games >= minimumGames && winImpact !== null, teams };
  });
  result.sort((a, b) => Number(b.rankingEligible) - Number(a.rankingEligible) || (b.winImpact ?? -Infinity) - (a.winImpact ?? -Infinity) || b.games - a.games || a.name.localeCompare(b.name, 'ko'));
  result.forEach((player, index) => { player.rank = player.rankingEligible ? result.filter(item => item.rankingEligible && (item.winImpact ?? -Infinity) > (player.winImpact ?? -Infinity)).length + 1 : null; });
  return { leagueId: Number(leagueId), minimumGames, players: result };
}

async function readWinImpact(pool, leagueId) {
  const result = await pool.query(`
    SELECT lm.id AS "leagueMemberId", lm.member_id AS "memberId", m.name,
      g.id AS "gameId",
      g.team_a_id AS "teamAId", ta.name AS "teamAName", g.team_b_id AS "teamBId", tb.name AS "teamBName", g.team_a_score AS "teamAScore", g.team_b_score AS "teamBScore",
      g.winner_team_id AS "winnerTeamId", a.id IS NOT NULL AS "attendanceRecorded", a.status AS "attendanceStatus", a.actual_team_id AS "actualTeamId"
    FROM league_member lm
    JOIN member m ON m.id = lm.member_id AND m.is_active = TRUE
    CROSS JOIN (SELECT g.id, gd.id AS game_day_id, g.team_a_id, g.team_b_id, g.team_a_score, g.team_b_score, g.winner_team_id, gd.game_date
      FROM game g JOIN game_day gd ON gd.id = g.game_day_id
      WHERE gd.league_id = $1 AND g.status = 'COMPLETED') g
    JOIN team ta ON ta.id = g.team_a_id
    JOIN team tb ON tb.id = g.team_b_id
    LEFT JOIN attendance a ON a.league_member_id = lm.id AND a.game_day_id = g.game_day_id
    WHERE lm.league_id = $1`, [leagueId]);
  return calculateWinImpact(result.rows, leagueId);
}

module.exports = { calculateWinImpact, readWinImpact };

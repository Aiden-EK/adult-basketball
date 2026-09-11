const MIN_COMBINATION_GAMES = 3;
const MIN_COMBINATION_SIZE = 3;
const round = value => Math.round(value * 10) / 10;

// Yield each subset once; callers provide players in canonical ID order.
function* generateCombinations(players, minSize = MIN_COMBINATION_SIZE, start = 0, selected = []) {
  if (selected.length >= minSize) yield selected;
  for (let index = start; index < players.length; index += 1) {
    yield* generateCombinations(players, minSize, index + 1, [...selected, players[index]]);
  }
}

function isEligibleGame(game) {
  return game.status === 'COMPLETED' && game.resultType !== 'FORFEIT'
    && game.winnerTeamId != null
    && [game.teamAId, game.teamBId].includes(game.winnerTeamId);
}

function calculateWinningCombinations({ teams, games, attendance }, leagueId, limit = 7) {
  const teamStats = new Map(teams.map(team => [team.teamId, { ...team, gamesPlayed: 0, wins: 0 }]));
  const eligibleGames = [...new Map(games.filter(isEligibleGame).map(game => [game.gameId, game])).values()];
  // Baselines include every eligible team game, even dates without attendance.
  for (const game of eligibleGames) {
    for (const teamId of [game.teamAId, game.teamBId]) {
      const team = teamStats.get(teamId);
      if (!team) continue;
      team.gamesPlayed += 1;
      if (game.winnerTeamId === teamId) team.wins += 1;
    }
  }

  const playersByDayTeam = new Map();
  for (const row of attendance) {
    if (!row.isActive || row.status !== 'PRESENT' || row.actualTeamId == null) continue;
    const key = `${row.gameDayId}:${row.actualTeamId}`;
    if (!playersByDayTeam.has(key)) playersByDayTeam.set(key, new Map());
    playersByDayTeam.get(key).set(row.leagueMemberId, {
      leagueMemberId: row.leagueMemberId, memberId: row.memberId, name: row.name, grade: row.grade
    });
  }

  const combinations = new Map();
  for (const game of eligibleGames) {
    for (const teamId of [game.teamAId, game.teamBId]) {
      if (!teamStats.has(teamId)) continue;
      const players = [...(playersByDayTeam.get(`${game.gameDayId}:${teamId}`)?.values() || [])]
        .sort((a, b) => a.leagueMemberId - b.leagueMemberId);
      for (const members of generateCombinations(players)) {
        const memberIds = members.map(member => member.leagueMemberId);
        const memberKey = memberIds.join('-');
        const key = `${teamId}:${memberKey}`;
        if (!combinations.has(key)) combinations.set(key, {
          key, memberKey, teamId, memberIds, members, memberCount: members.length, gamesPlayed: 0, wins: 0
        });
        const combination = combinations.get(key);
        combination.gamesPlayed += 1;
        if (game.winnerTeamId === teamId) combination.wins += 1;
      }
    }
  }

  const items = [...combinations.values()].filter(item => item.gamesPlayed >= MIN_COMBINATION_GAMES).map(item => {
    const team = teamStats.get(item.teamId);
    const combinationWinRate = item.wins / item.gamesPlayed * 100;
    const teamWinRate = team.wins / team.gamesPlayed * 100;
    return {
      ...item, teamName: team.teamName, teamSortOrder: team.teamSortOrder,
      losses: item.gamesPlayed - item.wins,
      combinationWinRate: round(combinationWinRate),
      teamGamesPlayed: team.gamesPlayed, teamWins: team.wins, teamLosses: team.gamesPlayed - team.wins,
      teamWinRate: round(teamWinRate), winImpact: round(combinationWinRate - teamWinRate)
    };
  });
  // Compare unrounded fractions so display rounding cannot change ranking or ties.
  items.sort((a, b) => {
    const aNumerator = a.wins * a.teamGamesPlayed - a.teamWins * a.gamesPlayed;
    const bNumerator = b.wins * b.teamGamesPlayed - b.teamWins * b.gamesPlayed;
    return bNumerator * a.gamesPlayed * a.teamGamesPlayed - aNumerator * b.gamesPlayed * b.teamGamesPlayed
      || b.wins * a.gamesPlayed - a.wins * b.gamesPlayed
      || b.wins - a.wins || b.gamesPlayed - a.gamesPlayed || a.memberCount - b.memberCount
      || a.teamSortOrder - b.teamSortOrder
      || (a.memberKey < b.memberKey ? -1 : a.memberKey > b.memberKey ? 1 : 0)
      || a.teamId - b.teamId;
  });
  return { leagueId: Number(leagueId), minGames: MIN_COMBINATION_GAMES,
    items: items.slice(0, limit).map(({ memberKey, ...item }, index) => ({ rank: index + 1, ...item })) };
}

async function readWinningCombinations(pool, leagueId, limit) {
  // One statement gives all three data sets the same database snapshot; no query per combination.
  const { rows } = await pool.query(`
    SELECT
      (SELECT COALESCE(json_agg(t), '[]'::json) FROM (
        SELECT id AS "teamId", name AS "teamName", sort_order AS "teamSortOrder"
        FROM team WHERE league_id = $1
      ) t) AS teams,
      (SELECT COALESCE(json_agg(g), '[]'::json) FROM (
        SELECT g.id AS "gameId", gd.id AS "gameDayId", g.team_a_id AS "teamAId",
          g.team_b_id AS "teamBId", g.winner_team_id AS "winnerTeamId",
          g.status, g.result_type AS "resultType"
        FROM game g JOIN game_day gd ON gd.id = g.game_day_id
        WHERE gd.league_id = $1 AND g.status = 'COMPLETED'
          AND COALESCE(g.result_type, 'NORMAL') <> 'FORFEIT'
          AND g.winner_team_id IN (g.team_a_id, g.team_b_id)
      ) g) AS games,
      (SELECT COALESCE(json_agg(a), '[]'::json) FROM (
        SELECT a.game_day_id AS "gameDayId", a.actual_team_id AS "actualTeamId", a.status,
          lm.id AS "leagueMemberId", m.id AS "memberId", m.name, m.grade, m.is_active AS "isActive"
        FROM attendance a JOIN game_day gd ON gd.id = a.game_day_id
        JOIN league_member lm ON lm.id = a.league_member_id AND lm.league_id = gd.league_id
        JOIN member m ON m.id = lm.member_id AND m.is_active = TRUE
        WHERE gd.league_id = $1 AND a.status = 'PRESENT' AND a.actual_team_id IS NOT NULL
      ) a) AS attendance`, [leagueId]);
  return calculateWinningCombinations(rows[0], leagueId, limit);
}

module.exports = { MIN_COMBINATION_GAMES, generateCombinations, calculateWinningCombinations, readWinningCombinations };

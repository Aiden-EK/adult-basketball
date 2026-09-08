function createTeamStanding(team) {
  return {
    rank: 0,
    teamId: Number(team.id),
    teamName: team.name,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    pointDifference: 0,
    winRate: 0
  };
}

function getWinnerId(game) {
  const homeId = Number(game.homeTeamId);
  const awayId = Number(game.awayTeamId);
  const winnerId = game.winnerTeamId === null ? null : Number(game.winnerTeamId);

  if (winnerId === homeId || winnerId === awayId) return winnerId;
  if (Number(game.homeScore) > Number(game.awayScore)) return homeId;
  if (Number(game.awayScore) > Number(game.homeScore)) return awayId;
  return null;
}

function compareWinRate(left, right) {
  const leftGames = left.gamesPlayed || 1;
  const rightGames = right.gamesPlayed || 1;
  return right.wins * leftGames - left.wins * rightGames;
}

function compareBaseMetrics(left, right) {
  return compareWinRate(left, right)
    || right.wins - left.wins
    || right.pointDifference - left.pointDifference
    || right.pointsFor - left.pointsFor;
}

function haveSameBaseMetrics(left, right) {
  return compareBaseMetrics(left, right) === 0;
}

function calculateStandings(teams, games) {
  const standingsByTeam = new Map(teams.map(team => {
    const standing = createTeamStanding(team);
    return [standing.teamId, standing];
  }));
  const completedGames = [];

  for (const game of games) {
    const home = standingsByTeam.get(Number(game.homeTeamId));
    const away = standingsByTeam.get(Number(game.awayTeamId));
    if (!home || !away || game.status !== 'COMPLETED' || game.homeScore === null || game.awayScore === null) continue;

    const homeScore = Number(game.homeScore);
    const awayScore = Number(game.awayScore);
    if (!Number.isSafeInteger(homeScore) || homeScore < 0 || !Number.isSafeInteger(awayScore) || awayScore < 0) continue;

    home.gamesPlayed += 1;
    away.gamesPlayed += 1;
    home.pointsFor += homeScore;
    home.pointsAgainst += awayScore;
    away.pointsFor += awayScore;
    away.pointsAgainst += homeScore;

    const winnerId = getWinnerId(game);
    if (winnerId === home.teamId) {
      home.wins += 1;
      away.losses += 1;
    } else if (winnerId === away.teamId) {
      away.wins += 1;
      home.losses += 1;
    }
    completedGames.push({ homeTeamId: home.teamId, awayTeamId: away.teamId, winnerId });
  }

  const standings = [...standingsByTeam.values()];
  for (const standing of standings) {
    standing.pointDifference = standing.pointsFor - standing.pointsAgainst;
    standing.winRate = standing.gamesPlayed === 0 ? 0 : standing.wins / standing.gamesPlayed;
  }
  standings.sort((left, right) => compareBaseMetrics(left, right) || left.teamName.localeCompare(right.teamName, 'ko'));

  let groupStart = 0;
  while (groupStart < standings.length) {
    let groupEnd = groupStart + 1;
    while (groupEnd < standings.length && haveSameBaseMetrics(standings[groupStart], standings[groupEnd])) groupEnd += 1;

    const group = standings.slice(groupStart, groupEnd);
    const groupIds = new Set(group.map(team => team.teamId));
    const headToHeadWins = new Map(group.map(team => [team.teamId, 0]));
    for (const game of completedGames) {
      if (game.winnerId && groupIds.has(game.homeTeamId) && groupIds.has(game.awayTeamId)) {
        headToHeadWins.set(game.winnerId, headToHeadWins.get(game.winnerId) + 1);
      }
    }
    group.sort((left, right) => headToHeadWins.get(right.teamId) - headToHeadWins.get(left.teamId) || left.teamName.localeCompare(right.teamName, 'ko'));
    standings.splice(groupStart, group.length, ...group);

    for (let index = groupStart; index < groupEnd; index += 1) {
      const previous = standings[index - 1];
      const current = standings[index];
      const sameRank = index > groupStart && headToHeadWins.get(previous.teamId) === headToHeadWins.get(current.teamId);
      current.rank = sameRank ? previous.rank : index + 1;
    }
    groupStart = groupEnd;
  }

  return standings;
}

module.exports = { calculateStandings };

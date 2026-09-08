class PlayerStandingsError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function calculatePlayerStandings(rows) {
  const players = rows.map(row => ({
    leagueMemberId: Number(row.leagueMemberId), memberId: Number(row.memberId), memberName: row.memberName,
    teamId: row.teamId === null ? null : Number(row.teamId), teamName: row.teamName,
    gamesScored: Number(row.gamesScored), totalPoints: Number(row.totalPoints),
  })).sort((a, b) => b.totalPoints - a.totalPoints || a.memberName.localeCompare(b.memberName, 'ko') || a.leagueMemberId - b.leagueMemberId);
  let previous = null;
  players.forEach((player, index) => {
    player.rank = previous === null || player.totalPoints !== previous ? index + 1 : players[index - 1].rank;
    player.averagePoints = player.gamesScored ? Number((player.totalPoints / player.gamesScored).toFixed(1)) : 0;
    previous = player.totalPoints;
  });
  return players;
}

async function readPlayerStandings(db, leagueId) {
  const league = await db.query('SELECT id FROM league WHERE id = $1', [leagueId]);
  if (!league.rowCount) throw new PlayerStandingsError(404, 'League not found');
  const result = await db.query(`
    SELECT lm.id AS "leagueMemberId", m.id AS "memberId", m.name AS "memberName",
           lm.team_id AS "teamId", t.name AS "teamName",
           COUNT(DISTINCT gps.game_id)::int AS "gamesScored",
           COALESCE(SUM(gps.points), 0)::int AS "totalPoints"
    FROM league_member lm
    JOIN member m ON m.id = lm.member_id
    LEFT JOIN team t ON t.id = lm.team_id AND t.league_id = lm.league_id
    LEFT JOIN game_player_score gps ON gps.league_member_id = lm.id
    LEFT JOIN game g ON g.id = gps.game_id AND g.status = 'COMPLETED'
    LEFT JOIN game_day gd ON gd.id = g.game_day_id AND gd.league_id = lm.league_id
    WHERE lm.league_id = $1
      AND (gps.id IS NULL OR (g.id IS NOT NULL AND gd.id IS NOT NULL))
    GROUP BY lm.id, m.id, m.name, lm.team_id, t.name
  `, [leagueId]);
  return calculatePlayerStandings(result.rows);
}

module.exports = { PlayerStandingsError, calculatePlayerStandings, readPlayerStandings };

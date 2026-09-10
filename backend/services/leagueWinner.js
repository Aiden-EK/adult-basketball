class LeagueWinnerError extends Error { constructor(status, message) { super(message); this.status = status } }

async function readLeagueWinner(db, leagueId) {
  const league = await db.query(`SELECT l.id, l.status, l.winner_team_id AS "winnerTeamId", t.name AS "winnerTeamName", t.captain_member_id AS "captainMemberId", captain.name AS "captainName"
    FROM league l LEFT JOIN team t ON t.id=l.winner_team_id AND t.league_id=l.id LEFT JOIN league_member captain_lm ON captain_lm.id=t.captain_member_id LEFT JOIN member captain ON captain.id=captain_lm.member_id WHERE l.id=$1`, [leagueId])
  if (!league.rowCount) throw new LeagueWinnerError(404, 'League not found')
  const row = league.rows[0]
  if (!row.winnerTeamId) return { leagueId, status: row.status, winner: null }
  const members = await db.query(`SELECT m.id AS "memberId", m.name, (lm.id=$3) AS "isCaptain" FROM league_member lm JOIN member m ON m.id=lm.member_id
    WHERE lm.league_id=$1 AND lm.team_id=$2 ORDER BY (lm.id=$3) DESC, m.name, m.id`, [leagueId, row.winnerTeamId, row.captainMemberId])
  return { leagueId, status: row.status, winner: { teamId: Number(row.winnerTeamId), teamName: row.winnerTeamName, captain: row.captainMemberId ? { memberId: Number(row.captainMemberId), name: row.captainName } : null, members: members.rows.map(member => ({ memberId: Number(member.memberId), name: member.name, ...(member.isCaptain ? { isCaptain: true } : {}) })) } }
}

async function readLeagueChampions(db) {
  const result = await db.query(`SELECT l.id AS "leagueId", l.year, l.quarter, l.name AS "leagueName",
    t.id AS "winnerTeamId", t.name AS "winnerTeamName", t.captain_member_id AS "captainMemberId",
    COALESCE(json_agg(json_build_object('memberId', m.id, 'name', m.name, 'isCaptain', lm.id=t.captain_member_id) ORDER BY (lm.id=t.captain_member_id) DESC, m.name, m.id)
      FILTER (WHERE m.id IS NOT NULL), '[]') AS members
    FROM league l
    JOIN team t ON t.id=l.winner_team_id AND t.league_id=l.id
    LEFT JOIN league_member lm ON lm.league_id=l.id AND lm.team_id=t.id
    LEFT JOIN member m ON m.id=lm.member_id
    WHERE l.status='COMPLETED'
    GROUP BY l.id, l.year, l.quarter, l.name, t.id, t.name, t.captain_member_id
    ORDER BY l.year DESC, l.quarter DESC, l.id DESC`)
  return result.rows.map(row => ({
    ...row,
    leagueId: Number(row.leagueId),
    winnerTeam: { teamId: Number(row.winnerTeamId), teamName: row.winnerTeamName, captain: row.captainMemberId ? { memberId: Number(row.captainMemberId) } : null },
    members: row.members.map(member => ({ ...member, memberId: Number(member.memberId) }))
  })).map(({ winnerTeamId, winnerTeamName, ...champion }) => champion)
}

async function setLeagueWinner(client, leagueId, teamId) {
  const league = await client.query('SELECT id,status FROM league WHERE id=$1 FOR UPDATE', [leagueId])
  if (!league.rowCount) throw new LeagueWinnerError(404, 'League not found')
  if (league.rows[0].status !== 'COMPLETED') throw new LeagueWinnerError(409, '종료된 리그만 우승팀을 확정할 수 있습니다.')
  const team = await client.query('SELECT id FROM team WHERE id=$1', [teamId])
  if (!team.rowCount) throw new LeagueWinnerError(404, 'Team not found')
  const sameLeagueTeam = await client.query('SELECT id FROM team WHERE id=$1 AND league_id=$2', [teamId, leagueId])
  if (!sameLeagueTeam.rowCount) throw new LeagueWinnerError(400, '해당 리그에 소속된 팀만 우승팀으로 지정할 수 있습니다.')
  await client.query('UPDATE league SET winner_team_id=$1 WHERE id=$2', [teamId, leagueId])
  return readLeagueWinner(client, leagueId)
}
module.exports = { LeagueWinnerError, readLeagueWinner, readLeagueChampions, setLeagueWinner }

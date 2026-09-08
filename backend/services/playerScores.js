class PlayerScoreError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function validateScores(scores) {
  if (!Array.isArray(scores)) throw new PlayerScoreError(400, 'scores는 배열이어야 합니다.');
  for (const score of scores) {
    if (!Number.isSafeInteger(score?.leagueMemberId) || score.leagueMemberId < 1) {
      throw new PlayerScoreError(400, '선수 정보가 올바르지 않습니다.');
    }
    if (!Number.isSafeInteger(score.points) || score.points < 0) {
      throw new PlayerScoreError(400, '득점은 0 이상의 정수만 입력할 수 있습니다.');
    }
  }
  if (new Set(scores.map(score => score.leagueMemberId)).size !== scores.length) {
    throw new PlayerScoreError(400, '같은 선수의 기록을 중복 입력할 수 없습니다.');
  }
  return scores;
}

function buildTeam(team, members, resultType) {
  const players = members.filter(member => Number(member.teamId) === Number(team.teamId));
  const points = players.filter(player => player.hasScore).reduce((sum, player) => sum + Number(player.points), 0);
  const difference = team.gameScore === null ? null : points - Number(team.gameScore);
  return { ...team, players, points, difference, matches: difference === 0, consistencyRequired: resultType !== 'FORFEIT' };
}

async function readPlayerScores(db, gameId) {
  const game = await db.query(`
    SELECT g.id AS "gameId", gd.league_id AS "leagueId", gd.game_date AS "gameDate",
           g.game_no AS "gameNo", g.status, g.result_type AS "resultType",
           g.winner_team_id AS "winnerTeamId", winner.name AS "winnerTeamName",
           g.team_a_id AS "teamAId", team_a.name AS "teamAName", g.team_a_score AS "teamAScore",
           g.team_b_id AS "teamBId", team_b.name AS "teamBName", g.team_b_score AS "teamBScore"
    FROM game g
    JOIN game_day gd ON gd.id = g.game_day_id
    JOIN team team_a ON team_a.id = g.team_a_id
    JOIN team team_b ON team_b.id = g.team_b_id
    LEFT JOIN team winner ON winner.id = g.winner_team_id
    WHERE g.id = $1
  `, [gameId]);
  if (!game.rowCount) return null;
  const row = game.rows[0];
  const members = await db.query(`
    SELECT lm.id AS "leagueMemberId", m.id AS "memberId", m.name,
           lm.team_id AS "teamId", COALESCE(score.points, 0) AS points,
           (score.id IS NOT NULL) AS "hasScore"
    FROM league_member lm
    JOIN member m ON m.id = lm.member_id
    LEFT JOIN game_player_score score ON score.league_member_id = lm.id AND score.game_id = $1
    WHERE lm.league_id = $2 AND lm.team_id IN ($3, $4)
    ORDER BY lm.team_id, m.name, lm.id
  `, [gameId, row.leagueId, row.teamAId, row.teamBId]);
  const teams = [
    { teamId: row.teamAId, teamName: row.teamAName, gameScore: row.teamAScore },
    { teamId: row.teamBId, teamName: row.teamBName, gameScore: row.teamBScore },
  ].map(team => buildTeam(team, members.rows, row.resultType));
  return { gameId: row.gameId, leagueId: row.leagueId, gameNo: row.gameNo, gameDate: row.gameDate, status: row.status, resultType: row.resultType, winnerTeamId: row.winnerTeamId, winnerTeamName: row.winnerTeamName, teams };
}

async function replacePlayerScores(client, gameId, scores) {
  const validatedScores = validateScores(scores);
  const scoresToStore = validatedScores.filter(score => score.points > 0);
  const game = await client.query(`
    SELECT g.status, gd.league_id AS "leagueId", g.team_a_id AS "teamAId", g.team_b_id AS "teamBId"
    FROM game g JOIN game_day gd ON gd.id = g.game_day_id
    WHERE g.id = $1 FOR UPDATE OF g
  `, [gameId]);
  if (!game.rowCount) throw new PlayerScoreError(404, '경기를 찾을 수 없습니다.');
  const current = game.rows[0];
  if (current.status !== 'COMPLETED') throw new PlayerScoreError(409, '완료된 경기만 개인 득점을 입력할 수 있습니다.');
  if (validatedScores.length) {
    const ids = validatedScores.map(score => score.leagueMemberId);
    const valid = await client.query(`
      SELECT id FROM league_member
      WHERE id = ANY($1::bigint[]) AND league_id = $2 AND team_id IN ($3, $4)
    `, [ids, current.leagueId, current.teamAId, current.teamBId]);
    if (valid.rowCount !== ids.length) throw new PlayerScoreError(400, '해당 경기 참가팀에 배정된 선수만 입력할 수 있습니다.');
  }
  await client.query('DELETE FROM game_player_score WHERE game_id = $1', [gameId]);
  for (const score of scoresToStore) {
    await client.query('INSERT INTO game_player_score (game_id, league_member_id, points) VALUES ($1, $2, $3)', [gameId, score.leagueMemberId, score.points]);
  }
}

module.exports = { PlayerScoreError, readPlayerScores, replacePlayerScores, validateScores };

function resolveWinnerTeamId(game) {
  if (game.status !== 'COMPLETED') return null;
  const teamAId = Number(game.teamAId);
  const teamBId = Number(game.teamBId);
  const winnerTeamId = game.winnerTeamId == null ? null : Number(game.winnerTeamId);
  if (winnerTeamId === teamAId || winnerTeamId === teamBId) return winnerTeamId;
  // Legacy completed games may have NULL result_type. Never infer a forfeit/tiebreak winner.
  if ((game.resultType ?? 'NORMAL') !== 'NORMAL') return null;
  if (game.teamAScore == null || game.teamBScore == null || game.teamAScore === '' || game.teamBScore === '') return null;
  const scoreA = Number(game.teamAScore);
  const scoreB = Number(game.teamBScore);
  if (!Number.isSafeInteger(scoreA) || scoreA < 0 || !Number.isSafeInteger(scoreB) || scoreB < 0) return null;
  return scoreA > scoreB ? teamAId : scoreB > scoreA ? teamBId : null;
}

function resolveWinnerForSave(game) {
  if (game.status === 'SCHEDULED') return { winnerTeamId: null };
  // Normal score edits must replace a previously stored winner, not preserve it.
  if (game.resultType === 'NORMAL' && game.teamAScore !== game.teamBScore) {
    return { winnerTeamId: resolveWinnerTeamId({ ...game, winnerTeamId: null }) };
  }
  const winnerTeamId = game.winnerTeamId;
  if (!winnerTeamId) return { error: game.resultType === 'FORFEIT' ? '몰수 경기의 승리팀을 선택해주세요.'
    : game.resultType === 'TIEBREAK' ? '동점 후 승부결정 경기의 승리팀을 선택해주세요.' : '점수가 같은 경우 승리팀을 지정해야 합니다.' };
  if (![game.teamAId, game.teamBId].includes(winnerTeamId)) return { error: '승리팀은 해당 경기의 팀 중 하나여야 합니다.' };
  return { winnerTeamId };
}

module.exports = { resolveWinnerTeamId, resolveWinnerForSave };

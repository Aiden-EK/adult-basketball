const nameCollator = new Intl.Collator('ko-KR')

export function buildAttendanceRanking(participants = []) {
  const sorted = [...participants].sort((left, right) =>
    Number(right.attendanceRate) - Number(left.attendanceRate)
    || Number(right.attendanceCount) - Number(left.attendanceCount)
    || nameCollator.compare(left.name, right.name)
    || Number(left.memberId) - Number(right.memberId)
  )
  let currentRank = 0

  return sorted.map((participant, index) => {
    const previous = sorted[index - 1]
    const isTied = previous
      && Number(previous.attendanceRate) === Number(participant.attendanceRate)
      && Number(previous.attendanceCount) === Number(participant.attendanceCount)
    if (!isTied) currentRank = index + 1
    return { ...participant, rank: currentRank }
  })
}

export function formatAttendanceRate(value) {
  const rate = Number(value)
  return Number.isInteger(rate) ? `${rate}%` : `${rate.toFixed(1)}%`
}

export function limitRankingWithTies(ranking, limit = 7) {
  if (ranking.length <= limit) return ranking
  const boundary = ranking[limit - 1]
  return ranking.filter((participant, index) => index < limit
    || (Number(participant.attendanceRate) === Number(boundary.attendanceRate)
      && Number(participant.attendanceCount) === Number(boundary.attendanceCount)))
}

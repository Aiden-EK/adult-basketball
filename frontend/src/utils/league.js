export function selectCurrentLeague(leagues) {
  return leagues
    .filter((league) => league.status === 'ACTIVE' || league.status === 'LIVE')
    .sort((a, b) => (b.year - a.year) || (b.quarter - a.quarter))[0] || null
}

export function groupLeaguesByYear(leagues) {
  return Object.entries(leagues.reduce((groups, league) => {
    const year = String(league.year)
    groups[year] = groups[year] || []
    groups[year].push(league)
    return groups
  }, {})).sort(([a], [b]) => Number(b) - Number(a))
}

// 리그명이 분기 표기를 이미 포함하면 선택 UI에서는 한 번만 보여준다.
export function formatLeagueLabel(league) {
  const season = `${league.year}년 ${league.quarter}분기`
  const name = String(league.name || '').trim()
  const normalizedSeason = season.replace(/\s/g, '')
  const normalizedName = name.replace(/\s/g, '')

  if (!name || normalizedName === normalizedSeason || normalizedName === `${normalizedSeason}리그`) return season
  return `${season} · ${name}`
}

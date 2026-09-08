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

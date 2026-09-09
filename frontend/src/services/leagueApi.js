import { apiRequest } from './api'
export const getLeagues = () => apiRequest('/leagues')
export const getLeague = (id) => apiRequest(`/leagues/${id}`)
export const getLeagueStandings = (id) => apiRequest(`/leagues/${id}/standings`)
export const getLeagueScorers = (id) => apiRequest(`/leagues/${id}/scorers`)
export const getLeagueWinner = (id) => apiRequest(`/leagues/${id}/winner`)
export const getLeagueChampions = () => apiRequest('/leagues/champions')
export const updateLeagueWinner = (leagueId, teamId) => apiRequest(`/admin/leagues/${leagueId}/winner`, { method: 'PATCH', body: JSON.stringify({ teamId }) })
export const createLeague = (data) => apiRequest('/admin/leagues', { method: 'POST', body: JSON.stringify(data) })

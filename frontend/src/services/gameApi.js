import { apiRequest } from './api'
export const getLeagueGames = (id) => apiRequest(`/leagues/${id}/games`)
export const getAdminLeagueGames = (id) => apiRequest(`/admin/leagues/${id}/games`)
export const createAdminGame = (id, data) => apiRequest(`/admin/leagues/${id}/games`, { method: 'POST', body: JSON.stringify(data) })
export const updateAdminGame = (leagueId, gameId, data) => apiRequest(`/admin/leagues/${leagueId}/games/${gameId}`, { method: 'PATCH', body: JSON.stringify(data) })
export const deleteAdminGame = (leagueId, gameId) => apiRequest(`/admin/leagues/${leagueId}/games/${gameId}`, { method: 'DELETE' })
export const getAdminPlayerScores = gameId => apiRequest(`/admin/games/${gameId}/player-scores`)
export const saveAdminPlayerScores = (gameId, scores) => apiRequest(`/admin/games/${gameId}/player-scores`, { method: 'PUT', body: JSON.stringify({ scores }) })
export const getPlayerScores = gameId => apiRequest(`/games/${gameId}/player-scores`)

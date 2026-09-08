import { apiRequest } from './api'
export const getLeagueParticipants = (leagueId) => apiRequest(`/leagues/${leagueId}/participants`)
export const getAdminLeagueParticipants = (leagueId) => apiRequest(`/admin/leagues/${leagueId}/participants`)
export const updateAdminLeagueParticipants = (leagueId, memberIds) => apiRequest(`/admin/leagues/${leagueId}/participants`, { method: 'PUT', body: JSON.stringify({ memberIds }) })

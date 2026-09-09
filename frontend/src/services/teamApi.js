import { apiRequest } from './api'
export const getLeagueTeams = (id) => apiRequest(`/leagues/${id}/teams`)
export const getAdminLeagueTeams = (id) => apiRequest(`/admin/leagues/${id}/teams`)
export const createAdminTeam = (id, data) => apiRequest(`/admin/leagues/${id}/teams`, { method: 'POST', body: JSON.stringify(data) })
export const updateAdminTeam = (leagueId, teamId, data) => apiRequest(`/admin/leagues/${leagueId}/teams/${teamId}`, { method: 'PATCH', body: JSON.stringify(data) })
export const deleteAdminTeam = (leagueId, teamId) => apiRequest(`/admin/leagues/${leagueId}/teams/${teamId}`, { method: 'DELETE' })
export const updateTeamAssignments = (id, assignments) => apiRequest(`/admin/leagues/${id}/teams/assignments`, { method: 'PUT', body: JSON.stringify({ assignments }) })
export const updateTeamCaptain = (leagueId, teamId, captainMemberId) => apiRequest(`/admin/leagues/${leagueId}/teams/${teamId}/captain`, { method: 'PATCH', body: JSON.stringify({ captainMemberId }) })

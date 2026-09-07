import { apiRequest } from './api'
export const getLeagues = () => apiRequest('/leagues')
export const getLeague = (id) => apiRequest(`/leagues/${id}`)
export const createLeague = (data) => apiRequest('/admin/leagues', { method: 'POST', body: JSON.stringify(data) })

import { apiRequest } from './api'
export const getMembers = () => apiRequest('/members')
export const getMember = (id) => apiRequest(`/members/${id}`)
export const getAdminMembers = () => apiRequest('/admin/members')
export const getAdminMember = (id) => apiRequest(`/admin/members/${id}`)
export const createAdminMember = (data) => apiRequest('/admin/members', { method: 'POST', body: JSON.stringify(data) })
export const updateAdminMember = (id, data) => apiRequest(`/admin/members/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
export const updateAdminMemberNote = (id, note) => apiRequest(`/admin/members/${id}/note`, { method: 'PATCH', body: JSON.stringify({ note }) })

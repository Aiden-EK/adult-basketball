import { apiRequest } from './api'
export const getAdminMembers = () => apiRequest('/admin/members')
export const getAdminMember = (id) => apiRequest(`/admin/members/${id}`)
export const updateAdminMemberNote = (id, note) => apiRequest(`/admin/members/${id}/note`, { method: 'PATCH', body: JSON.stringify({ note }) })

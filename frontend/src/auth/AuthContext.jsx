import { useEffect, useState } from 'react'
import { apiRequest } from '../services/api'
import { AuthContext } from './authContextValue'
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); const [loading, setLoading] = useState(true)
  useEffect(() => { apiRequest('/auth/me').then(data => setUser(data.user)).catch(() => setUser(null)).finally(() => setLoading(false)) }, [])
  const login = async (loginId, password) => { const data = await apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ loginId, password }) }); setUser(data.user) }
  const logout = async () => { await apiRequest('/auth/logout', { method: 'POST' }); setUser(null) }
  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
}

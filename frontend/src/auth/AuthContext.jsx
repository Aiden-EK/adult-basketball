import { useEffect, useState } from 'react'
import { apiRequest } from '../services/api'
import { AuthContext } from './authContextValue'
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); const [loading, setLoading] = useState(true); const [sessionExpired, setSessionExpired] = useState(false)
  useEffect(() => {
    const expireSession = () => { setSessionExpired(true); setUser(null) }
    window.addEventListener('admin-session-expired', expireSession)
    apiRequest('/auth/me').then(data => setUser(data.user)).catch(() => setUser(null)).finally(() => setLoading(false))
    return () => window.removeEventListener('admin-session-expired', expireSession)
  }, [])
  const login = async (loginId, password) => { const data = await apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ loginId, password }) }); setSessionExpired(false); setUser(data.user) }
  const logout = async () => { try { await apiRequest('/auth/logout', { method: 'POST' }) } catch { /* 로컬 인증 상태는 항상 정리합니다. */ } finally { setSessionExpired(false); setUser(null) } }
  return <AuthContext.Provider value={{ user, loading, sessionExpired, login, logout }}>{children}</AuthContext.Provider>
}

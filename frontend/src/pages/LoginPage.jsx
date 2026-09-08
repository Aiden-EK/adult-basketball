import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import PageTitle from '../components/PageTitle'
import { useAuth } from '../auth/useAuth'
export default function LoginPage() {
  const { user, sessionExpired, login } = useAuth(); const navigate = useNavigate(); const location = useLocation(); const [loginId, setLoginId] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  if (user?.role === 'ADMIN') return <Navigate to="/admin" replace />
  const submit = async event => { event.preventDefault(); setBusy(true); setError(''); try { await login(loginId, password); navigate(location.state?.from || '/admin', { replace: true }) } catch (e) { setError(e.message) } finally { setBusy(false) } }
  return <><PageTitle eyebrow="ADMIN LOGIN" title="관리자 로그인" description="관리자 계정으로 로그인하세요." />{sessionExpired && <p className="notice" role="status">세션이 만료되었습니다. 다시 로그인해주세요.</p>}<form className="form card" onSubmit={submit}><label htmlFor="loginId">로그인 ID</label><input id="loginId" autoComplete="username" value={loginId} onChange={e => setLoginId(e.target.value)} required /><label htmlFor="password">비밀번호</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />{error && <p className="error">{error}</p>}<button className="primary full" disabled={busy}>{busy ? '로그인 중...' : '로그인'}</button></form></>
}

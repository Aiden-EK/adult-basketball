const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'
const CONNECTION_ERROR = '서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.'

function isProtectedRequest(path) {
  return path === '/members' || path.startsWith('/members/') || path === '/admin' || path.startsWith('/admin/')
}

export async function apiRequest(path, options = {}) {
  let response
  try {
    const requestOptions = { credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options }
    if (!requestOptions.cache && String(requestOptions.method || 'GET').toUpperCase() === 'GET') requestOptions.cache = 'no-store'
    response = await fetch(`${API_BASE}${path}`, requestOptions)
  } catch {
    const error = new Error(CONNECTION_ERROR)
    error.status = 0
    throw error
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401 && isProtectedRequest(path)) window.dispatchEvent(new Event('admin-session-expired'))
    const error = new Error(data.message || data.error || '요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.')
    error.status = response.status
    throw error
  }
  return data
}

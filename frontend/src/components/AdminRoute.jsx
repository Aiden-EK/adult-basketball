import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { Loading } from './Status'
export default function AdminRoute() { const { user, loading } = useAuth(); const location = useLocation(); if (loading) return <Loading />; if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />; if (user.role !== 'ADMIN') return <Navigate to="/" replace />; return <Outlet /> }

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import { getProtectedRouteDecision, getRoleDashboard } from './authRouting.js';

export function AuthLoading() {
  return <div className="auth-loading" role="status" aria-live="polite">Checking your session…</div>;
}

export function ProtectedRoute({ role }) {
  const { user, status } = useAuth();
  const location = useLocation();
  if (status === 'initializing') return <AuthLoading />;
  const decision = getProtectedRouteDecision(user, role);
  if (decision === 'login') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (decision === 'unauthorized') return <Navigate to="/unauthorized" replace />;
  return <Outlet />;
}

export function GuestOnlyRoute() {
  const { user, status } = useAuth();
  if (status === 'initializing') return <AuthLoading />;
  if (user) return <Navigate to={getRoleDashboard(user.role)} replace />;
  return <Outlet />;
}

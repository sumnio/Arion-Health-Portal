import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import { getProtectedRouteDecision, getRoleDashboard } from './authRouting.js';

export function AuthLoading() {
  return <div className="auth-loading" role="status" aria-live="polite">Checking your session…</div>;
}

export function ProtectedRoute({ role }) {
  const { user, status, explicitLogout } = useAuth();
  const location = useLocation();
  if (status === 'initializing') return <AuthLoading />;
  const decision = getProtectedRouteDecision(user, role);
  if (decision === 'login') return <Navigate to="/login" replace state={explicitLogout ? null : { from: location.pathname }} />;
  if (decision === 'unauthorized') return <Navigate to="/unauthorized" replace />;
  return <Outlet />;
}

export function GuestOnlyRoute() {
  const { user, status } = useAuth();
  const location = useLocation();
  if (status === 'initializing') return <AuthLoading />;
  if (user) {
    const requestedPath = location.state?.from;
    const destination = requestedPath?.startsWith(`/${user.role}/`)
      ? requestedPath
      : getRoleDashboard(user.role);
    return <Navigate to={destination} replace />;
  }
  return <Outlet />;
}

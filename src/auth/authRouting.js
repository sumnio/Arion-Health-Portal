const dashboards = {
  patient: '/patient/dashboard',
  doctor: '/doctor/dashboard',
  staff: '/staff/dashboard',
  admin: '/admin/dashboard',
};

export function getRoleDashboard(role) {
  return dashboards[role] || '/unauthorized';
}

export function getProtectedRouteDecision(user, requiredRole) {
  if (!user) return 'login';
  if (user.status !== 'active' || user.role !== requiredRole) return 'unauthorized';
  return 'allow';
}

import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { routeGroups } from './routes.js';
import PublicLayout from '../layouts/PublicLayout.jsx';
import PublicPage from '../pages/public/PublicPage.jsx';
import PlaceholderPage from '../components/PlaceholderPage.jsx';
import PatientLayout from '../layouts/PatientLayout.jsx';
import PatientPage from '../pages/patient/PatientPage.jsx';
import DoctorLayout from '../layouts/DoctorLayout.jsx';
import DoctorPage from '../pages/doctor/DoctorPage.jsx';
import StaffLayout from '../layouts/StaffLayout.jsx';
import StaffPage from '../pages/staff/StaffPage.jsx';
import AdminLayout from '../layouts/AdminLayout.jsx';
import AdminPage from '../pages/admin/AdminPage.jsx';
import { GuestOnlyRoute, ProtectedRoute } from '../auth/RouteGuards.jsx';

const roleComponents = { patient: [PatientLayout, PatientPage], doctor: [DoctorLayout, DoctorPage], staff: [StaffLayout, StaffPage], admin: [AdminLayout, AdminPage] };
export default function AppRouter() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.getElementById('main-content')?.focus();
    window.scrollTo(0, 0);
  }, [pathname]);
  return <Routes>
    <Route element={<PublicLayout />}>
      {routeGroups.public.filter(route => !['/login', '/register'].includes(route.path)).map(route => <Route key={route.path} path={route.path} element={<PublicPage route={route} />} />)}
      <Route element={<GuestOnlyRoute />}>
        {routeGroups.public.filter(route => ['/login', '/register'].includes(route.path)).map(route => <Route key={route.path} path={route.path} element={<PublicPage route={route} />} />)}
      </Route>
      <Route path="*" element={<PlaceholderPage title="Page not found" links={[{ to: '/', label: 'Back to home' }]} />} />
    </Route>
    {Object.entries(roleComponents).map(([role, [Layout, Page]]) => <Route key={role} element={<ProtectedRoute role={role} />}>
      <Route element={<Layout />}>
        {routeGroups[role].map(route => <Route key={route.path} path={route.path} element={<Page route={route} />} />)}
      </Route>
    </Route>)}
  </Routes>;
}


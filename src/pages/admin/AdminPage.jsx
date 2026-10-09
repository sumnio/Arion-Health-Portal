import PlaceholderPage from '../../components/PlaceholderPage.jsx';
import AdminDashboard from './AdminDashboard.jsx';
import ManagePatients from './ManagePatients.jsx';
import ManageDoctors from './ManageDoctors.jsx';
import ManageStaff from './ManageStaff.jsx';
import AnalyticsRoute from '../analytics/AnalyticsRoute.jsx';
import NotificationsPage from '../notifications/NotificationsPage.jsx';
export default function AdminPage({ route }) {
  if (route.path === '/admin/dashboard') return <AdminDashboard />;
  if (route.path === '/admin/analytics') return <AnalyticsRoute />;
  if (route.path === '/admin/patients') return <ManagePatients />;
  if (route.path === '/admin/doctors') return <ManageDoctors />;
  if (route.path === '/admin/staff') return <ManageStaff />;
  if (route.path === '/admin/notifications') return <NotificationsPage />;
  return <PlaceholderPage title={route.title} />;
}


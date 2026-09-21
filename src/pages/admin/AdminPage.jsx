import PlaceholderPage from '../../components/PlaceholderPage.jsx';
import AdminDashboard from './AdminDashboard.jsx';
import ManageDoctors from './ManageDoctors.jsx';
import { getPageLinks } from '../../app/pageLinks.js';
export default function AdminPage({ route }) {
  if (route.path === '/admin/dashboard') return <AdminDashboard />;
  if (route.path === '/admin/doctors') return <ManageDoctors />;
  return <PlaceholderPage title={route.title} links={getPageLinks(route.path)} />;
}


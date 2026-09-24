import PlaceholderPage from '../../components/PlaceholderPage.jsx';
import AdminDashboard from './AdminDashboard.jsx';
import ManagePatients from './ManagePatients.jsx';
import ManageDoctors from './ManageDoctors.jsx';
import ManageStaff from './ManageStaff.jsx';
import { getPageLinks } from '../../app/pageLinks.js';
export default function AdminPage({ route }) {
  if (route.path === '/admin/dashboard') return <AdminDashboard />;
  if (route.path === '/admin/patients') return <ManagePatients />;
  if (route.path === '/admin/doctors') return <ManageDoctors />;
  if (route.path === '/admin/staff') return <ManageStaff />;
  return <PlaceholderPage title={route.title} links={getPageLinks(route.path)} />;
}


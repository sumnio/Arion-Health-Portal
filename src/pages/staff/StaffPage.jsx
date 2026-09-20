import StaffDashboard from './StaffDashboard.jsx';
import PlaceholderPage from '../../components/PlaceholderPage.jsx';
import { getPageLinks } from '../../app/pageLinks.js';
export default function StaffPage({ route }) {
  if (route.path === '/staff/dashboard') return <StaffDashboard />;
  return <PlaceholderPage title={route.title} links={getPageLinks(route.path)} />;
}


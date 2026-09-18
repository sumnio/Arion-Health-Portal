import PlaceholderPage from '../../components/PlaceholderPage.jsx';
import { getPageLinks } from '../../app/pageLinks.js';
import DoctorDashboard from './DoctorDashboard.jsx';
export default function DoctorPage({ route }) {
  if (route.path === '/doctor/dashboard') return <DoctorDashboard />;
  return <PlaceholderPage title={route.title} links={getPageLinks(route.path)} />;
}


import PlaceholderPage from '../../components/PlaceholderPage.jsx';
import { getPageLinks } from '../../app/pageLinks.js';
import PatientDashboard from './PatientDashboard.jsx';
export default function PatientPage({ route }) {
  if (route.path === '/patient/dashboard') return <PatientDashboard />;
  return <PlaceholderPage title={route.title} links={getPageLinks(route.path)} />;
}


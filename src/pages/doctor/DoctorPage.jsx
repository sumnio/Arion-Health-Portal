import PlaceholderPage from '../../components/PlaceholderPage.jsx';
import { getPageLinks } from '../../app/pageLinks.js';
import DoctorDashboard from './DoctorDashboard.jsx';
import DoctorSchedule from './DoctorSchedule.jsx';
export default function DoctorPage({ route }) {
  if (route.path === '/doctor/dashboard') return <DoctorDashboard />;
  if (route.path === '/doctor/schedule') return <DoctorSchedule />;
  return <PlaceholderPage title={route.title} links={getPageLinks(route.path)} />;
}


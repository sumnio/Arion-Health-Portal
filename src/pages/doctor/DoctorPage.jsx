import PlaceholderPage from '../../components/PlaceholderPage.jsx';
import { getPageLinks } from '../../app/pageLinks.js';
import DoctorDashboard from './DoctorDashboard.jsx';
import DoctorSchedule from './DoctorSchedule.jsx';
import DoctorPatientDetail from './DoctorPatientDetail.jsx';
export default function DoctorPage({ route }) {
  if (route.path === '/doctor/dashboard') return <DoctorDashboard />;
  if (route.path === '/doctor/schedule') return <DoctorSchedule />;
  if (route.path === '/doctor/patients/:id') return <DoctorPatientDetail />;
  return <PlaceholderPage title={route.title} links={getPageLinks(route.path)} />;
}

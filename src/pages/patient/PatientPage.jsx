import PlaceholderPage from '../../components/PlaceholderPage.jsx';
import { getPageLinks } from '../../app/pageLinks.js';
import PatientDashboard from './PatientDashboard.jsx';
import PatientBooking from './PatientBooking.jsx';
import PatientAppointments from './PatientAppointments.jsx';
import PatientAppointmentDetail from './PatientAppointmentDetail.jsx';
export default function PatientPage({ route }) {
  if (route.path === '/patient/dashboard') return <PatientDashboard />;
  if (route.path === '/patient/book') return <PatientBooking />;
  if (route.path === '/patient/appointments') return <PatientAppointments />;
  if (route.path === '/patient/appointments/:id') return <PatientAppointmentDetail />;
  return <PlaceholderPage title={route.title} links={getPageLinks(route.path)} />;
}


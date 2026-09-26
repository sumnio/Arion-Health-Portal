import PlaceholderPage from '../../components/PlaceholderPage.jsx';
import PatientDashboard from './PatientDashboard.jsx';
import PatientBooking from './PatientBooking.jsx';
import PatientAppointments from './PatientAppointments.jsx';
import PatientAppointmentDetail from './PatientAppointmentDetail.jsx';
import PatientRecords from './PatientRecords.jsx';
import PatientRecordDetail from './PatientRecordDetail.jsx';
import PatientCertificates from './PatientCertificates.jsx';
import PatientCertificateDetail from './PatientCertificateDetail.jsx';
import PatientProfile from './PatientProfile.jsx';
export default function PatientPage({ route }) {
  if (route.path === '/patient/dashboard') return <PatientDashboard />;
  if (route.path === '/patient/profile') return <PatientProfile />;
  if (route.path === '/patient/book') return <PatientBooking />;
  if (route.path === '/patient/appointments') return <PatientAppointments />;
  if (route.path === '/patient/appointments/:id') return <PatientAppointmentDetail />;
  if (route.path === '/patient/records') return <PatientRecords />;
  if (route.path === '/patient/records/:id') return <PatientRecordDetail />;
  if (route.path === '/patient/certificates') return <PatientCertificates />;
  if (route.path === '/patient/certificates/:id') return <PatientCertificateDetail />;
  return <PlaceholderPage title={route.title} />;
}


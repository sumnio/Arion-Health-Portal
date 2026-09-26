import StaffDashboard from './StaffDashboard.jsx';
import StaffCalendar from './StaffCalendar.jsx';
import StaffQueue from './StaffQueue.jsx';
import StaffPatients from './StaffPatients.jsx';
import StaffRegisterWalkIn from './StaffRegisterWalkIn.jsx';
import StaffWalkInAppointment from './StaffWalkInAppointment.jsx';
import PlaceholderPage from '../../components/PlaceholderPage.jsx';
export default function StaffPage({ route }) {
  if (route.path === '/staff/dashboard') return <StaffDashboard />;
  if (route.path === '/staff/calendar') return <StaffCalendar />;
  if (route.path === '/staff/queue') return <StaffQueue />;
  if (route.path === '/staff/patients') return <StaffPatients />;
  if (route.path === '/staff/patients/new') return <StaffRegisterWalkIn />;
  if (route.path === '/staff/patients/:id/walk-in') return <StaffWalkInAppointment />;
  return <PlaceholderPage title={route.title} />;
}


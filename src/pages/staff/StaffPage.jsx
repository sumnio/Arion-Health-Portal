import StaffDashboard from './StaffDashboard.jsx';
import StaffCalendar from './StaffCalendar.jsx';
import StaffQueue from './StaffQueue.jsx';
import PlaceholderPage from '../../components/PlaceholderPage.jsx';
import { getPageLinks } from '../../app/pageLinks.js';
export default function StaffPage({ route }) {
  if (route.path === '/staff/dashboard') return <StaffDashboard />;
  if (route.path === '/staff/calendar') return <StaffCalendar />;
  if (route.path === '/staff/queue') return <StaffQueue />;
  return <PlaceholderPage title={route.title} links={getPageLinks(route.path)} />;
}


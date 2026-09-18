import PlaceholderPage from '../../components/PlaceholderPage.jsx';
import { getPageLinks } from '../../app/pageLinks.js';
export default function DoctorPage({ route }) {
  return <PlaceholderPage title={route.title} links={getPageLinks(route.path)} />;
}


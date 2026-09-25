import PlaceholderPage from '../../components/PlaceholderPage.jsx';
import LandingPage from './LandingPage.jsx';
import LoginPage from './LoginPage.jsx';
import RegisterPage from './RegisterPage.jsx';
import UnauthorizedPage from './UnauthorizedPage.jsx';
export default function PublicPage({ route }) {
  if (route.path === '/') return <LandingPage />;
  if (route.path === '/login') return <LoginPage />;
  if (route.path === '/register') return <RegisterPage />;
  if (route.path === '/unauthorized') return <UnauthorizedPage />;
  return <PlaceholderPage title={route.title} links={[{ to: '/login', label: 'Go to login' }, { to: '/register', label: 'Go to registration' }]} />;
}

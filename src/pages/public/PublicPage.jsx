import PlaceholderPage from '../../components/PlaceholderPage.jsx';
import LandingPage from './LandingPage.jsx';
import LoginPage from './LoginPage.jsx';
import RegisterPage from './RegisterPage.jsx';
import UnauthorizedPage from './UnauthorizedPage.jsx';
import VerifyEmailPage from './VerifyEmailPage.jsx';
import ForgotPasswordPage from './ForgotPasswordPage.jsx';
import ResetPasswordPage from './ResetPasswordPage.jsx';
export default function PublicPage({ route }) {
  if (route.path === '/') return <LandingPage />;
  if (route.path === '/login') return <LoginPage />;
  if (route.path === '/register') return <RegisterPage />;
  if (route.path === '/verify-email') return <VerifyEmailPage />;
  if (route.path === '/forgot-password') return <ForgotPasswordPage />;
  if (route.path === '/reset-password') return <ResetPasswordPage />;
  if (route.path === '/unauthorized') return <UnauthorizedPage />;
  return <PlaceholderPage title={route.title} links={[{ to: '/login', label: 'Go to login' }, { to: '/register', label: 'Go to registration' }]} />;
}

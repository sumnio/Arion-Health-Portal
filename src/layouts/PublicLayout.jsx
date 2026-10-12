import { Link, Outlet, useLocation } from 'react-router-dom';
import Brand from '../components/Brand.jsx';
import ArionAssistantChat from '../components/assistant/ArionAssistantChat.jsx';
import { PUBLIC_ASSISTANT_CONFIG } from '../components/assistant/assistantConfig.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { publicAssistantApiService } from '../services/publicAssistantApiService.js';
import '../styles/public.css';

const PUBLIC_ASSISTANT_PATHS = new Set(['/', '/login', '/register', '/forgot-password']);

export default function PublicLayout() {
  const location = useLocation();
  const { status } = useAuth();
  const home = location.pathname === '/';
  const showAssistant = status === 'guest' && PUBLIC_ASSISTANT_PATHS.has(location.pathname);
  return <div className={'public-shell public-v2 ' + (home ? 'landing-shell' : 'auth-shell')}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="portal-header"><Brand /><nav aria-label="Public navigation">{home ? <><Link className="public-button secondary" to="/login">Login</Link><Link className="public-button primary" to="/register">Register</Link></> : <Link className="back-home" to="/">← Back to Home</Link>}</nav></header>
    <main id="main-content" tabIndex="-1"><Outlet /></main>
    <footer className="portal-footer"><span><strong>Arion Health Portal</strong><br />Your Health. Our Priority.</span><span>Secure portal access</span></footer>
    {showAssistant && <ArionAssistantChat
      service={publicAssistantApiService}
      welcomeText={PUBLIC_ASSISTANT_CONFIG.welcomeMessage}
      suggestions={PUBLIC_ASSISTANT_CONFIG.suggestions}
    />}
  </div>;
}

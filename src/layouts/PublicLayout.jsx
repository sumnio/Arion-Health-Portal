import { Link, Outlet, useLocation } from 'react-router-dom';
import Brand from '../components/Brand.jsx';
import '../styles/public.css';
export default function PublicLayout() {
  const home = useLocation().pathname === '/';
  return <div className={'public-shell public-v2 ' + (home ? 'landing-shell' : 'auth-shell')}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="portal-header"><Brand /><nav aria-label="Public navigation">{home ? <><Link className="public-button secondary" to="/login">Login</Link><Link className="public-button primary" to="/register">Register</Link></> : <Link className="back-home" to="/">← Back to Home</Link>}</nav></header>
    <main id="main-content" tabIndex="-1"><Outlet /></main>
    <footer className="portal-footer"><span><strong>Arion Health Portal</strong><br />Your Health. Our Priority.</span><span>Mock preview · No data is saved</span></footer>
  </div>;
}

import { useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Brand from '../components/Brand.jsx';
import Navigation from '../components/Navigation.jsx';
import { routeGroups } from '../app/routes.js';
import { useAuth } from '../auth/AuthContext.jsx';

export default function PortalLayout({ role }) {
  const collapsible = role === 'patient' || role === 'doctor' || role === 'staff' || role === 'admin';
  const { user: profile, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuPath, setMenuPath] = useState(null);
  const menuOpen = menuPath === pathname;
  const menuButton = useRef(null);
  function closeOnEscape(event) {
    if (event.key === 'Escape' && menuOpen) {
      setMenuPath(null);
      menuButton.current?.focus();
    }
  }
  async function signOut() {
    try { await logout(); }
    finally { navigate('/login', { replace: true }); }
  }
  return <div className={'portal-shell theme-' + role}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="portal-header" onKeyDown={closeOnEscape}>
      {collapsible && <button ref={menuButton} className="patient-menu-toggle" type="button" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls={role + '-sidebar'} onClick={() => setMenuPath(menuOpen ? null : pathname)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d={menuOpen ? 'M6 6l12 12M6 18 18 6' : 'M4 6h16M4 12h16M4 18h16'} /></svg></button>}
      <Brand /><div className="identity" aria-label={profile.display_name + ', ' + role}><span className="avatar" aria-hidden="true">{role[0].toUpperCase()}</span><span className="identity-description">{profile.display_name}<small>{profile.role}</small></span></div>
    </header>
    <aside id={collapsible ? role + '-sidebar' : undefined} className={'sidebar' + (menuOpen ? ' sidebar-open' : '')} onKeyDown={closeOnEscape} onClick={event => { if (event.target.closest('a')) setMenuPath(null); }}><Navigation label={role + ' navigation'} routes={routeGroups[role].filter(route => !route.path.includes(':id'))} /><button className="exit-link" type="button" onClick={signOut}>Log out</button></aside>
    <main id="main-content" tabIndex="-1"><Outlet /></main>
    <footer className="portal-footer">Arion Health Portal · {role === 'patient' ? 'Connected to the clinic API' : 'Feature data remains mocked'}</footer>
  </div>;
}


import { Link, Outlet } from 'react-router-dom';
import Brand from '../components/Brand.jsx';
import Navigation from '../components/Navigation.jsx';
import { routeGroups } from '../app/routes.js';
import { portalService } from '../services/portalService.js';

export default function PortalLayout({ role }) {
  const profile = portalService.getPreviewProfile(role);
  return <div className={'portal-shell theme-' + role}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="portal-header"><Brand /><div className="identity"><span className="avatar" aria-hidden="true">{role[0].toUpperCase()}</span><span>{profile.display_name}<small>{profile.role} · Mock preview</small></span></div></header>
    <aside className="sidebar"><Navigation label={role + ' navigation'} routes={routeGroups[role].filter(route => !route.path.includes(':id'))} /><Link className="exit-link" to="/login">Exit mock preview</Link></aside>
    <main id="main-content" tabIndex="-1"><Outlet /></main>
    <footer className="portal-footer">Arion Health Portal · Mock data only</footer>
  </div>;
}


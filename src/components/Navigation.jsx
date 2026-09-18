import { NavLink } from 'react-router-dom';
export default function Navigation({ routes, label }) {
  return <nav aria-label={label}>{routes.map(({ path, title }) => <NavLink key={path} to={path} end={path === '/' || path.endsWith('/patients')} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>{title}</NavLink>)}</nav>;
}


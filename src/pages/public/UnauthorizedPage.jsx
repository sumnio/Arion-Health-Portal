import { Link, useNavigate } from 'react-router-dom';
import AuthCard from '../../components/public/AuthCard.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { getRoleDashboard } from '../../auth/authRouting.js';

export default function UnauthorizedPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function signOut() {
    try { await logout(); }
    finally { navigate('/login', { replace: true }); }
  }

  return <AuthCard title="Access not allowed" subtitle="Your account cannot open this part of the portal.">
    {user ? <div className="context-links">
      <Link className="public-button primary" to={getRoleDashboard(user.role)}>Go to my dashboard</Link>
      <button className="public-button secondary" type="button" onClick={signOut}>Log out</button>
    </div> : <Link className="public-button primary full-width" to="/login">Go to login</Link>}
  </AuthCard>;
}

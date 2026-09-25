import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthCard from '../../components/public/AuthCard.jsx';
import FormField from '../../components/public/FormField.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { getRoleDashboard } from '../../auth/authRouting.js';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, accessMessage } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(Object.fromEntries(new FormData(event.currentTarget)));
      const requestedPath = location.state?.from;
      const destination = requestedPath?.startsWith('/' + user.role + '/') ? requestedPath : getRoleDashboard(user.role);
      navigate(destination, { replace: true });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <AuthCard title="Login to Your Account" subtitle="Welcome back. Access your health portal.">
    <div className="auth-notice"><strong>Secure account access</strong><p>Use your Arion Health Portal email and password. Your account role determines which portal opens.</p></div>
    <form onSubmit={submit}>
      <FormField label="Email" name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
      <FormField label="Password" name="password" type="password" placeholder="Enter your password" autoComplete="current-password" required />
      {!error && accessMessage && <p className="form-error" role="alert">{accessMessage}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="public-button primary full-width" disabled={busy} type="submit">{busy ? 'Signing in…' : 'Login'}</button>
    </form>
    <p className="auth-switch">Don’t have an account? <Link to="/register">Register here</Link></p>
  </AuthCard>;
}


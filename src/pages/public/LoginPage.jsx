import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthCard from '../../components/public/AuthCard.jsx';
import FormField from '../../components/public/FormField.jsx';
import { authService } from '../../services/authService.js';

export default function LoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await authService.login(Object.fromEntries(new FormData(event.currentTarget)));
      navigate('/' + result.role + '/dashboard');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <AuthCard title="Login to Your Account" subtitle="Welcome back. Access your health portal.">
    <div className="mock-notice"><strong>Mock access for testing</strong><p>Use a sample email and any non-empty password. Select a role to preview its layout. Nothing is saved.</p></div>
    <form onSubmit={submit}>
      <FormField label="Email" name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
      <FormField label="Password" name="password" type="password" placeholder="Enter a sample password" autoComplete="off" required />
      <FormField label="Preview role (mock only)" name="role" defaultValue="patient" required>
        <option value="patient">Patient</option><option value="doctor">Doctor</option><option value="staff">Staff</option><option value="admin">Admin</option>
      </FormField>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="public-button primary full-width" disabled={busy} type="submit">{busy ? 'Opening preview…' : 'Login'}</button>
    </form>
    <p className="auth-switch">Don’t have an account? <Link to="/register">Register here</Link></p>
  </AuthCard>;
}


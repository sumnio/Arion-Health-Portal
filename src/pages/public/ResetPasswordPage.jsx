import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthCard from '../../components/public/AuthCard.jsx';
import FormField from '../../components/public/FormField.jsx';
import { apiErrorMessage } from '../../services/apiClient.js';
import { authService } from '../../services/authService.js';

const INVALID_LINK = 'This password reset link is invalid or has expired.';

export default function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const token = new URLSearchParams(location.search).get('token');
    const establish = token
      ? authService.createPasswordResetSession(token)
      : authService.getPasswordResetStatus();
    establish
      .then(() => {
        if (!active) return;
        if (token) navigate('/reset-password', { replace: true });
        setState('ready');
      })
      .catch(() => {
        if (!active) return;
        if (token) navigate('/reset-password', { replace: true });
        setError(INVALID_LINK);
        setState('error');
      });
    return () => { active = false; };
  }, [location.search, navigate]);

  async function submit(event) {
    event.preventDefault();
    setError('');
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (values.password !== values.confirm_password) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await authService.resetPassword(values.password, values.confirm_password);
      setState('success');
    } catch (requestError) {
      setError(apiErrorMessage(requestError, {
        fallback: 'Unable to reset your password right now. Try again later.',
        codeMessages: {
          PASSWORD_RESET_SESSION_EXPIRED:
            'Your password reset session has expired. Request a new link.',
        },
      }));
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading') {
    return <AuthCard title="Checking reset link" subtitle="Please wait while we securely validate your password reset request." />;
  }
  if (state === 'error') {
    return <AuthCard title="Reset link unavailable" subtitle={error || INVALID_LINK}>
      <p className="auth-switch"><Link to="/forgot-password">Request a new link</Link></p>
      <p className="auth-switch"><Link to="/login">Back to Login</Link></p>
    </AuthCard>;
  }
  if (state === 'success') {
    return <AuthCard title="Password reset successful" subtitle="Your password has been reset successfully.">
      <p className="auth-switch"><Link to="/login">Continue to Login</Link></p>
    </AuthCard>;
  }

  return <AuthCard title="Create a new password" subtitle="Use at least 8 characters for your new password.">
    <form onSubmit={submit}>
      <FormField
        label="New Password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength="8"
        maxLength="128"
        required
      />
      <FormField
        label="Confirm New Password"
        name="confirm_password"
        type="password"
        autoComplete="new-password"
        minLength="8"
        maxLength="128"
        required
      />
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="public-button primary full-width" disabled={busy} type="submit">
        {busy ? 'Resetting…' : 'Reset Password'}
      </button>
    </form>
    <p className="auth-switch"><Link to="/login">Back to Login</Link></p>
  </AuthCard>;
}

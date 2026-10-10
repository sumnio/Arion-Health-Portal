import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthCard from '../../components/public/AuthCard.jsx';
import FormField from '../../components/public/FormField.jsx';
import { apiErrorMessage } from '../../services/apiClient.js';
import { authService } from '../../services/authService.js';

const GENERIC_MESSAGE =
  'If a Patient account exists for that email, password reset instructions have been sent.';

export default function ForgotPasswordPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await authService.forgotPassword(new FormData(event.currentTarget).get('email'));
      setSent(true);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, {
        fallback: 'Unable to request a password reset right now. Try again later.',
      }));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return <AuthCard title="Check your email" subtitle={GENERIC_MESSAGE}>
      <p className="auth-switch"><Link to="/login">Back to Login</Link></p>
    </AuthCard>;
  }

  return <AuthCard
    title="Forgot your password?"
    subtitle="Enter your email address and we'll send password reset instructions if a Patient account exists."
  >
    <form onSubmit={submit}>
      <FormField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        required
      />
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="public-button primary full-width" disabled={busy} type="submit">
        {busy ? 'Sending…' : 'Send Reset Link'}
      </button>
    </form>
    <p className="auth-switch"><Link to="/login">Back to Login</Link></p>
  </AuthCard>;
}

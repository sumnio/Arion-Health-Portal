import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import AuthCard from '../../components/public/AuthCard.jsx';
import FormField from '../../components/public/FormField.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { getRoleDashboard } from '../../auth/authRouting.js';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    login, verifyMfa, cancelMfa, accessMessage, status, mfaState, mfaSetup,
  } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [qrImage, setQrImage] = useState('');

  useEffect(() => {
    let active = true;
    if (!mfaSetup?.otpauth_uri) {
      setQrImage('');
      return undefined;
    }
    QRCode.toDataURL(mfaSetup.otpauth_uri, { width: 220, margin: 1 })
      .then((image) => { if (active) setQrImage(image); })
      .catch(() => { if (active) setError('The QR code could not be displayed. Use the manual setup key.'); });
    return () => { active = false; };
  }, [mfaSetup]);

  function openPortal(user) {
    const requestedPath = location.state?.from;
    const destination = requestedPath?.startsWith('/' + user.role + '/')
      ? requestedPath
      : getRoleDashboard(user.role);
    navigate(destination, { replace: true });
  }

  async function submitLogin(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await login(Object.fromEntries(new FormData(event.currentTarget)));
      if (result.user) openPortal(result.user);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function submitMfa(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget));
      openPortal(await verifyMfa(values.code));
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function returnToLogin() {
    setError('');
    setBusy(true);
    try { await cancelMfa(); }
    finally { setBusy(false); }
  }

  if (status === 'mfa_pending') {
    const setup = mfaState === 'setup';
    return <AuthCard
      title={setup ? 'Set Up Admin Verification' : 'Admin Verification'}
      subtitle={setup ? 'Protect this privileged account with an authenticator app.' : 'Enter the current code from your authenticator app.'}
    >
      {setup && <div className="mfa-enrollment">
        <ol>
          <li>Scan this QR code with an authenticator app.</li>
          <li>Enter the six-digit code shown by the app.</li>
        </ol>
        {qrImage && <img className="mfa-qr" src={qrImage} alt="Authenticator setup QR code" />}
        <p className="mfa-manual-label">Manual setup key</p>
        <code className="mfa-manual-key">{mfaSetup?.manual_key}</code>
      </div>}
      <form onSubmit={submitMfa}>
        <FormField
          label="6-digit verification code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength="6"
          placeholder="000000"
          required
        />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="public-button primary full-width" disabled={busy} type="submit">
          {busy ? 'Verifying…' : setup ? 'Finish Setup' : 'Verify and Continue'}
        </button>
        <button className="auth-secondary-button" disabled={busy} type="button" onClick={returnToLogin}>Return to login</button>
      </form>
      <p className="mfa-recovery-note">If you lose authenticator access, contact the system operator for offline account recovery.</p>
    </AuthCard>;
  }

  return <AuthCard title="Login to Your Account" subtitle="Welcome back. Access your health portal.">
    <div className="auth-notice"><strong>Secure account access</strong><p>Use your Arion Health Portal email and password. Your account role determines which portal opens.</p></div>
    <form onSubmit={submitLogin}>
      <FormField label="Email" name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
      <FormField label="Password" name="password" type="password" placeholder="Enter your password" autoComplete="current-password" required />
      {!error && accessMessage && <p className="form-error" role="alert">{accessMessage}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="public-button primary full-width" disabled={busy} type="submit">{busy ? 'Signing in…' : 'Login'}</button>
    </form>
    <p className="auth-switch">Don’t have an account? <Link to="/register">Register here</Link></p>
  </AuthCard>;
}

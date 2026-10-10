import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AuthCard from '../../components/public/AuthCard.jsx';
import { authService } from '../../services/authService.js';

const EMPTY_CODE = ['', '', '', '', '', ''];

export default function VerifyEmailPage() {
  const location = useLocation();
  const [digits, setDigits] = useState(EMPTY_CODE);
  const [maskedEmail, setMaskedEmail] = useState(location.state?.maskedEmail ?? '');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [sessionAvailable, setSessionAvailable] = useState(true);
  const inputs = useRef([]);

  useEffect(() => {
    let active = true;
    authService.getEmailVerificationStatus()
      .then(result => {
        if (!active) return;
        setMaskedEmail(result.masked_email);
        if (result.code_status === 'expired' || result.code_status === 'attempts_exhausted') {
          setError('Your code is no longer valid. Request a new code below.');
        }
      })
      .catch(() => { if (active) setSessionAvailable(false); });
    return () => { active = false; };
  }, []);

  function setCode(values, focusIndex) {
    setDigits(values);
    if (focusIndex != null) inputs.current[focusIndex]?.focus();
  }

  function changeDigit(index, value) {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length > 1) {
      const next = [...digits];
      numbers.slice(0, 6 - index).split('').forEach((digit, offset) => { next[index + offset] = digit; });
      setCode(next, Math.min(index + numbers.length, 5));
      return;
    }
    const next = [...digits];
    next[index] = numbers;
    setCode(next, numbers && index < 5 ? index + 1 : null);
  }

  function keyDown(index, event) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = '';
      setCode(next, index - 1);
    }
  }

  function pasteCode(event) {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    event.preventDefault();
    setCode([...pasted.padEnd(6, ' ')].map(value => value.trim()), Math.min(pasted.length, 5));
  }

  async function submit(event) {
    event.preventDefault();
    const code = digits.join('');
    if (code.length !== 6) { setError('Enter all 6 digits from your verification email.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      await authService.verifyEmail(code);
      setVerified(true);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function resend() {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await authService.resendEmailVerification();
      setMaskedEmail(result.masked_email);
      setDigits(EMPTY_CODE);
      setNotice('A new code was sent. The previous code no longer works.');
      inputs.current[0]?.focus();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  if (verified) return <AuthCard title="Email Verified" subtitle="Your patient account is ready.">
    <div className="registration-success" role="status">
      <span className="success-symbol" aria-hidden="true">✓</span>
      <h2>Verification complete</h2>
      <p>Log in with your email and password to enter the Patient portal.</p>
      <Link className="public-button primary full-width" to="/login">Continue to login</Link>
    </div>
  </AuthCard>;

  if (!sessionAvailable) return <AuthCard title="Verify Your Email" subtitle="Your verification session is not available.">
    <p className="form-error" role="alert">Return to login and enter your email and password to continue verification.</p>
    <Link className="public-button primary full-width" to="/login">Return to login</Link>
  </AuthCard>;

  return <AuthCard title="Verify Your Email" subtitle={`We sent a 6-digit code to ${maskedEmail || 'your email address'}.`}>
    <p className="auth-notice">Enter the newest code below. It expires after 10 minutes and can be used once.</p>
    <form onSubmit={submit}>
      <fieldset className="otp-fieldset">
        <legend>6-digit email verification code</legend>
        <div className="otp-inputs" onPaste={pasteCode}>
          {digits.map((digit, index) => <input
            key={index}
            ref={node => { inputs.current[index] = node; }}
            aria-label={`Verification digit ${index + 1}`}
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            inputMode="numeric"
            pattern="[0-9]"
            maxLength="1"
            value={digit}
            onChange={event => changeDigit(index, event.target.value)}
            onKeyDown={event => keyDown(index, event)}
          />)}
        </div>
      </fieldset>
      {notice && <p className="form-success" role="status">{notice}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="public-button primary full-width" disabled={busy} type="submit">
        {busy ? 'Verifying…' : 'Verify Email'}
      </button>
      <button className="auth-secondary-button" disabled={busy} type="button" onClick={resend}>
        Resend code
      </button>
    </form>
    <p className="auth-switch"><Link to="/login">Return to login</Link></p>
  </AuthCard>;
}

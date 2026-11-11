import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import FormField from '../../components/public/FormField.jsx';
import { authService } from '../../services/authService.js';

export default function ClaimAccountPage() {
  const [params] = useSearchParams(); const token = params.get('token') ?? '';
  const [state, setState] = useState({ step: 'loading', maskedEmail: '', otpSession: '', claimSession: '', error: '' });
  const [code, setCode] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; authService.inspectPortalInvitation(token).then(result => active && setState({ step: 'ready', maskedEmail: result.masked_email, otpSession: '', claimSession: '', error: '' })).catch(() => active && setState(current => ({ ...current, step: 'invalid', error: 'This invitation is invalid, expired, or already used.' }))); return () => { active = false; }; }, [token]);
  async function sendCode() { setBusy(true); try { const result = await authService.sendPortalClaimCode(token); setState(current => ({ ...current, step: 'code', maskedEmail: result.masked_email, otpSession: result.otp_session, error: '' })); } catch { setState(current => ({ ...current, error: 'Unable to send a verification code. Try again later.' })); } finally { setBusy(false); } }
  async function verify(event) { event.preventDefault(); setBusy(true); try { const result = await authService.verifyPortalClaimCode(token, state.otpSession, code); setState(current => ({ ...current, step: 'password', claimSession: result.claim_session, error: '' })); } catch { setState(current => ({ ...current, error: 'The verification code is invalid or expired.' })); } finally { setBusy(false); } }
  async function complete(event) { event.preventDefault(); if (password.length < 8 || password !== confirm) { setState(current => ({ ...current, error: password.length < 8 ? 'Password must contain at least 8 characters.' : 'Passwords do not match.' })); return; } setBusy(true); try { await authService.completePortalClaim(token, state.claimSession, password); setState(current => ({ ...current, step: 'success', error: '' })); } catch { setState(current => ({ ...current, error: 'This account claim could not be completed. The invitation may have changed or already been used.' })); } finally { setBusy(false); } }
  return <section className="auth-card">
    <header className="auth-heading"><span className="auth-mark">✚</span><h1>Claim Your Portal Account</h1><p>Create secure access to your existing clinic Patient record.</p></header>
    {state.error && <p className="auth-error" role="alert">{state.error}</p>}
    {state.step === 'loading' && <p role="status">Checking invitation…</p>}
    {state.step === 'invalid' && <Link className="public-button primary full-width" to="/login">Return to login</Link>}
    {state.step === 'ready' && <>
      <p>Your invitation is for <strong>{state.maskedEmail}</strong>. Verify this email before creating your password.</p>
      <button className="public-button primary full-width" type="button" disabled={busy} onClick={sendCode}>{busy ? 'Sending…' : 'Send verification code'}</button>
    </>}
    {state.step === 'code' && <form onSubmit={verify}>
      <FormField name="claim-code" label="6-digit verification code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}/>
      <button className="public-button primary full-width" type="submit" disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : 'Verify email'}</button>
    </form>}
    {state.step === 'password' && <form onSubmit={complete}>
      <FormField name="claim-password" label="Create password" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={password} onChange={event => setPassword(event.target.value)}/>
      <FormField name="claim-confirm-password" label="Confirm password" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={confirm} onChange={event => setConfirm(event.target.value)}/>
      <button className="public-button primary full-width" type="submit" disabled={busy}>{busy ? 'Creating account…' : 'Create portal account'}</button>
    </form>}
    {state.step === 'success' && <>
      <p role="status">Your portal account is ready. Your existing clinic history remains linked.</p>
      <Link className="public-button primary full-width" to="/login">Continue to login</Link>
    </>}
  </section>;
}

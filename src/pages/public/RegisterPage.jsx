import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthCard from '../../components/public/AuthCard.jsx';
import FormField from '../../components/public/FormField.jsx';
import { authService } from '../../services/authService.js';

export default function RegisterPage() {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const now = new Date();
  const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setError('');
    setBusy(true);
    try {
      await authService.registerPatient(Object.fromEntries(new FormData(form)));
      form.reset();
      setSuccess(true);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <AuthCard title="Create Your Account" subtitle="Join Arion Health Portal as a patient." wide>
    {success ? <div className="registration-success" role="status">
      <span className="success-symbol" aria-hidden="true">✓</span>
      <h2>Mock registration complete</h2><p>Your form was validated. No account was created and no information was saved.</p>
      <Link className="public-button primary full-width" to="/login">Continue to login</Link>
    </div> : <>
      <p className="mock-notice">Patient self-registration preview. Use sample information only; nothing is saved.</p>
      <form onSubmit={submit}>
        <FormField label="Full Name" name="display_name" placeholder="e.g. Alex Santos" autoComplete="name" required />
        <div className="form-grid">
          <FormField label="Email" name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
          <FormField label="Phone Number" name="contact_number" type="tel" placeholder="09XX XXX XXXX" autoComplete="tel" required />
          <FormField label="Date of Birth" name="dob" type="date" max={today} autoComplete="bday" required />
          <FormField label="Sex" name="sex" defaultValue="" required><option value="" disabled>Select</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></FormField>
          <FormField label="Password" name="password" type="password" placeholder="Create a sample password" autoComplete="off" required />
          <FormField label="Confirm Password" name="confirmPassword" type="password" placeholder="Confirm your password" autoComplete="off" required />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="public-button primary full-width" disabled={busy} type="submit">{busy ? 'Checking details…' : 'Create Account'}</button>
      </form>
    </>}
    <p className="auth-switch">Already have an account? <Link to="/login">Login here</Link></p>
  </AuthCard>;
}


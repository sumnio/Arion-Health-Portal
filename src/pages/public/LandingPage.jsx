import { Link } from 'react-router-dom';
import ClinicIllustration from '../../components/public/ClinicIllustration.jsx';

const highlights = [
  ['calendar', 'Book Appointments', 'Schedule your visit with your healthcare provider.'],
  ['record', 'Access Your Records', 'Keep your visit history and medical certificates in one place.'],
  ['people', 'Quality Healthcare', 'Stay connected with your clinic’s doctors and support staff.'],
];
function FeatureIcon({ kind }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'calendar' ? <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4m8-4v4M4 11h16m-12 4 3 3 5-5" /></>
      : kind === 'record' ? <><path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6" /></>
      : <><circle cx="12" cy="7" r="3" /><path d="M6 21v-3a6 6 0 0 1 12 0v3M4 5a3 3 0 0 0 0 6m16-6a3 3 0 0 1 0 6M2 19v-3a4 4 0 0 1 3-4m17 7v-3a4 4 0 0 0-3-4" /></>}
  </svg>;
}
export default function LandingPage() {
  return <div className="landing-content">
    <section className="landing-hero" aria-labelledby="welcome-title">
      <div className="hero-copy"><p className="eyebrow">Your Health. Our Priority.</p>
        <h1 id="welcome-title">Welcome to<br />Arion Health Portal</h1>
        <p className="hero-lead">Accessible. Reliable. Patient-centered care.</p>
        <p>Book appointments, view your medical records, and stay connected with your healthcare provider — all in one place.</p>
        <div className="hero-actions"><Link className="public-button primary" to="/login">Login <span aria-hidden="true">→</span></Link><Link className="public-button secondary" to="/register">Register</Link></div>
      </div>
      <div className="hero-art"><ClinicIllustration /><span className="art-caption">A healthier tomorrow starts here.</span></div>
    </section>
    <section className="landing-highlights" aria-label="Your patient portal">
      {highlights.map(([kind, title, description]) => <article key={kind}><span className="feature-icon"><FeatureIcon kind={kind} /></span><h2>{title}</h2><p>{description}</p></article>)}
    </section>
    <section className="community-section" aria-labelledby="community-title">
      <div className="community-heart" aria-hidden="true">♡</div><div><p className="eyebrow">Care that brings us together</p><h2 id="community-title">A Healthier Community<br />for a Brighter Tomorrow</h2><p>Arion Health Portal connects you with Arion Health Clinic, making it easier to manage your appointments and access your health information.</p></div>
      <div className="community-art" aria-hidden="true"><span>✚</span><div className="community-people"><i /><i /><i /></div></div>
    </section>
  </div>;
}


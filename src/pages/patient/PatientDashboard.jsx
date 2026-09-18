import { Link } from 'react-router-dom';
import { patientDashboardService } from '../../services/patientDashboardService.js';
import DashboardCard from '../../components/dashboard/DashboardCard.jsx';
import DashboardIcon from '../../components/dashboard/DashboardIcon.jsx';
import DateTile from '../../components/dashboard/DateTile.jsx';
import StatusBadge from '../../components/dashboard/StatusBadge.jsx';
import '../../styles/patient-dashboard.css';

const shortcuts = [
  { to: '/patient/book', icon: 'calendar', title: 'Book Appointment', description: 'Schedule your next visit' },
  { to: '/patient/records', icon: 'record', title: 'My Records', description: 'Access your medical history' },
  { to: '/patient/certificates', icon: 'certificate', title: 'My Certificates', description: 'View your medical certificates' },
  { to: '/patient/profile', icon: 'profile', title: 'My Profile', description: 'View your personal information' },
];

export default function PatientDashboard() {
  const { profile, nextAppointment, recentRecord, doctor } = patientDashboardService.getDashboard();
  return <div className="patient-dashboard">
    <section className="dashboard-welcome" aria-labelledby="patient-welcome">
      <div><p className="welcome-greeting">Good day,</p><h1 id="patient-welcome">{profile.display_name}!</h1>
        <p>Take charge of your health. Book appointments, view your records, and stay connected with your healthcare provider — all in one place.</p>
      </div>
      <div className="welcome-visual" aria-hidden="true">
        <svg viewBox="0 0 140 150" fill="none"><circle cx="70" cy="65" r="53" fill="#e6edf3" /><path d="M14 150c0-35 24-57 56-57s56 22 56 57" fill="#a8b8c7" /><path d="M54 88h32v27c-9 10-23 10-32 0" fill="#c8d2dc" /><ellipse cx="70" cy="64" rx="34" ry="41" fill="#d4dde5" /><path d="M36 60c-10-45 64-61 70-12l-5 18-9-30c-15 19-39 19-56 24Z" fill="#40566b" /><path d="M55 66h1m28 0h1" stroke="#40566b" strokeWidth="5" strokeLinecap="round" /><path d="M62 84q8 6 16 0" stroke="#8c9cae" strokeWidth="3" strokeLinecap="round" /></svg>
        <span>A<br />Healthier<br />You<br />Today<span className="welcome-line" /></span>
      </div>
    </section>
    <nav className="dashboard-shortcuts" aria-label="Patient shortcuts">
      {shortcuts.map(({ to, icon, title, description }) => <Link key={to} to={to} className="dashboard-shortcut">
        <span className="shortcut-icon"><DashboardIcon name={icon} /></span><span><strong>{title}</strong><small>{description}</small></span><span className="shortcut-arrow" aria-hidden="true">›</span>
      </Link>)}
    </nav>
    <div className="dashboard-previews">
      <DashboardCard title="Next Appointment" viewAllTo="/patient/appointments">
        {nextAppointment ? <><div className="dashboard-preview-body"><DateTile value={nextAppointment.appointment_at} />
          <div className="preview-copy"><h3>{nextAppointment.reason}</h3>
            <p className="detail-line"><DashboardIcon name="profile" />{doctor.display_name}</p>
            <p className="detail-line"><DashboardIcon name="clock" /><time dateTime={nextAppointment.appointment_at}>{new Date(nextAppointment.appointment_at).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' })} (Philippine time)</time></p>
            <p className="detail-line"><DashboardIcon name="location" />Arion Health Clinic</p>
            <StatusBadge status={nextAppointment.status} />
          </div></div><Link className="action-link dashboard-primary" to="/patient/appointments">View My Appointments</Link></>
          : <><p className="dashboard-empty">No upcoming appointment.</p><Link className="action-link" to="/patient/book">Book Appointment</Link></>}
      </DashboardCard>
      <DashboardCard title="Recent Medical Record" viewAllTo="/patient/records">
        {recentRecord ? <><div className="dashboard-preview-body"><DateTile value={recentRecord.encounter_at} />
          <div className="preview-copy"><h3>Consultation record</h3>
            <p className="detail-line"><DashboardIcon name="profile" />{doctor.display_name}</p>
            <p><strong>Diagnosis:</strong> {recentRecord.diagnosis}</p>
            <p><strong>Notes:</strong> {recentRecord.notes}</p>
            <p><strong>Follow-up:</strong> {recentRecord.follow_up ?? 'None recorded'}</p>
          </div></div><Link className="action-link" to="/patient/records">View My Records</Link></>
          : <p className="dashboard-empty">No medical records yet.</p>}
      </DashboardCard>
    </div>
    <p className="dashboard-sample-note">Sample information for preview only.</p>
  </div>;
}


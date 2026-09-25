import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { patientApiErrorMessage, patientApiService } from '../../services/patientApiService.js';
import DashboardCard from '../../components/dashboard/DashboardCard.jsx';
import DashboardIcon from '../../components/dashboard/DashboardIcon.jsx';
import DateTile from '../../components/dashboard/DateTile.jsx';
import StatusBadge from '../../components/dashboard/StatusBadge.jsx';
import '../../styles/patient-dashboard.css';

const shortcuts = [
  ['/patient/book', 'calendar', 'Book Appointment', 'Schedule your next visit'],
  ['/patient/records', 'record', 'My Records', 'Access your medical history'],
  ['/patient/certificates', 'certificate', 'My Certificates', 'View your medical certificates'],
  ['/patient/profile', 'profile', 'My Profile', 'View your personal information'],
];

export default function PatientDashboard() {
  const [data, setData] = useState(null); const [error, setError] = useState('');
  useEffect(() => { let active = true; patientApiService.getDashboard().then(value => active && setData(value)).catch(reason => active && setError(patientApiErrorMessage(reason, 'Dashboard information was not found.'))); return () => { active = false; }; }, []);
  if (error) return <section className="dashboard-welcome" role="alert"><h1>Unable to load your dashboard</h1><p>{error}</p></section>;
  if (!data) return <section className="dashboard-welcome" aria-live="polite"><h1>Loading your dashboard…</h1></section>;
  const { profile, nextAppointment, recentRecord } = data;
  return <div className="patient-dashboard">
    <section className="dashboard-welcome"><div><p className="welcome-greeting">Good day,</p><h1>{profile.fullName}!</h1><p>Take charge of your health. Book appointments, view your records, and stay connected with your healthcare provider — all in one place.</p></div></section>
    <nav className="dashboard-shortcuts" aria-label="Patient shortcuts">{shortcuts.map(([to, icon, title, description]) => <Link key={to} to={to} className="dashboard-shortcut"><span className="shortcut-icon"><DashboardIcon name={icon} /></span><span><strong>{title}</strong><small>{description}</small></span><span className="shortcut-arrow">›</span></Link>)}</nav>
    <div className="dashboard-previews">
      <DashboardCard title="Next Appointment" viewAllTo="/patient/appointments">{nextAppointment ? <><div className="dashboard-preview-body"><DateTile value={nextAppointment.appointment_at} /><div className="preview-copy"><h3>{nextAppointment.service}</h3><p className="detail-line"><DashboardIcon name="profile" />{nextAppointment.doctor}</p><p className="detail-line"><DashboardIcon name="clock" />{nextAppointment.timeLabel} · Philippine time</p><StatusBadge status={nextAppointment.status} /></div></div><Link className="action-link dashboard-primary" to={'/patient/appointments/' + nextAppointment.id}>View Appointment</Link></> : <><p className="dashboard-empty">No upcoming appointment.</p><Link className="action-link" to="/patient/book">Book Appointment</Link></>}</DashboardCard>
      <DashboardCard title="Recent Medical Record" viewAllTo="/patient/records">{recentRecord ? <><div className="dashboard-preview-body"><DateTile value={recentRecord.encounter_at} /><div className="preview-copy"><h3>{recentRecord.visitType}</h3><p className="detail-line"><DashboardIcon name="profile" />{recentRecord.doctor}</p><p><strong>Diagnosis:</strong> {recentRecord.diagnosis}</p><p><strong>Notes:</strong> {recentRecord.notes || 'None recorded'}</p></div></div><Link className="action-link" to={'/patient/records/' + recentRecord.id}>View Record</Link></> : <p className="dashboard-empty">No medical records yet.</p>}</DashboardCard>
    </div>
  </div>;
}

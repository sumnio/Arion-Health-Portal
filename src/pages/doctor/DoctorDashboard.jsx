import { Link } from 'react-router-dom';
import DashboardCard from '../../components/dashboard/DashboardCard.jsx';
import DashboardIcon from '../../components/dashboard/DashboardIcon.jsx';
import StatusBadge from '../../components/dashboard/StatusBadge.jsx';
import { doctorDashboardService } from '../../services/doctorDashboardService.js';
import { formatBookingDate } from '../../services/bookingService.js';
import '../../styles/doctor-dashboard.css';

export default function DoctorDashboard() {
  const dashboard = doctorDashboardService.getDashboard();
  const next = dashboard.nextPatient;
  return <div className="doctor-dashboard">
    <div className="doctor-dashboard-top"><div>
      <header className="doctor-welcome"><div><p>Welcome,</p><h1>{dashboard.profile.display_name}</h1><p>Here’s your schedule overview for today.</p><p>{formatBookingDate(dashboard.date)} · Philippine time</p><Link className="action-link" to="/doctor/schedule">My Schedule</Link></div><span className="doctor-welcome-icon"><DashboardIcon name="profile" /></span></header>
      <p className="doctor-mock-note">Mock snapshot at 10:00 AM today. This preview does not update live.</p>
      <div className="doctor-counts"><section className="doctor-panel"><DashboardIcon name="calendar" /><div><h2>Today’s Appointments</h2><strong>{dashboard.total}</strong></div></section><section className="doctor-panel"><DashboardIcon name="record" /><div><h2>Completed Today</h2><strong>{dashboard.completed}</strong></div></section></div>
    </div><section className="doctor-panel doctor-next"><h2>Next Patient</h2>{next ? <><div className="doctor-next-summary"><strong>{next.timeLabel}</strong><h3>{next.patientName}</h3><p>{next.reason}</p><StatusBadge status={next.status} /></div><Link className="action-link doctor-primary" to={next.patientPath}>View Patient Details →</Link></> : <p>No confirmed upcoming appointments.</p>}</section></div>
    <DashboardCard title="Today’s Schedule" viewAllTo="/doctor/schedule" viewAllLabel="View Full Schedule">
      <p className="doctor-schedule-note">{dashboard.upcoming.length} upcoming appointments in this mock snapshot.</p>
      <ul className="doctor-schedule">{dashboard.appointments.map(item => <li key={item.id}><time dateTime={item.appointment_at}>{item.timeLabel}</time><div><h3>{item.patientName}</h3><p>{item.reason}</p></div><StatusBadge status={item.status} /><Link to={item.patientPath} aria-label={'View patient details for ' + item.patientName}>View Patient <span aria-hidden="true">→</span></Link></li>)}</ul>
    </DashboardCard>
  </div>;
}

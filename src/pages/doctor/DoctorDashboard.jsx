import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardCard from '../../components/dashboard/DashboardCard.jsx';
import DashboardIcon from '../../components/dashboard/DashboardIcon.jsx';
import StatusBadge from '../../components/dashboard/StatusBadge.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { doctorApiErrorMessage, doctorApiService } from '../../services/doctorApiService.js';
import { formatBookingDate } from '../../services/dateTimeService.js';
import '../../styles/doctor-dashboard.css';

export default function DoctorDashboard() {
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, dashboard: null, error: '' });
  useEffect(() => { let active = true; doctorApiService.getDashboard().then((dashboard) => active && setState({ loading: false, dashboard, error: '' })).catch((error) => active && setState({ loading: false, dashboard: null, error: doctorApiErrorMessage(error, 'Unable to load the Doctor dashboard.') })); return () => { active = false; }; }, []);
  if (state.loading) return <div className="doctor-dashboard"><p role="status">Loading Doctor dashboard…</p></div>;
  if (state.error) return <div className="doctor-dashboard"><h1>Doctor Dashboard</h1><p role="alert">{state.error}</p></div>;
  const dashboard = state.dashboard; const next = dashboard.nextPatient;
  return <div className="doctor-dashboard">
    <div className="doctor-dashboard-top"><div>
      <header className="doctor-welcome"><div><p>Welcome,</p><h1>{user?.display_name ?? 'Doctor'}</h1><p>Here’s your schedule overview for today.</p><p>{formatBookingDate(dashboard.date)} · Philippine time</p><Link className="action-link" to="/doctor/schedule">My Schedule</Link></div><span className="doctor-welcome-icon"><DashboardIcon name="profile" /></span></header>
      <p className="doctor-mock-note">Live appointment data from Arion Health Portal.</p>
      <div className="doctor-counts"><section className="doctor-panel"><DashboardIcon name="calendar" /><div><h2>Today’s Appointments</h2><strong>{dashboard.total}</strong></div></section><section className="doctor-panel"><DashboardIcon name="record" /><div><h2>Completed Today</h2><strong>{dashboard.completed}</strong></div></section></div>
    </div><section className="doctor-panel doctor-next"><h2>Next Patient</h2>{next ? <><div className="doctor-next-summary"><strong>{next.timeLabel}</strong><h3>{next.patientName}</h3><p>{next.visitLabel} · {next.reason}</p><StatusBadge status={next.status} /></div><Link className="action-link doctor-primary" to={next.patientPath} state={{ appointmentId: next.id, date: next.date }}>View Patient Details →</Link></> : <p>No confirmed or pending upcoming appointments today.</p>}</section></div>
    <DashboardCard title="Today’s Schedule" viewAllTo="/doctor/schedule" viewAllLabel="View Full Schedule"><p className="doctor-schedule-note">{dashboard.upcoming.length} upcoming {dashboard.upcoming.length === 1 ? 'appointment' : 'appointments'} today.</p>{dashboard.appointments.length ? <ul className="doctor-schedule">{dashboard.appointments.map(item => <li key={item.id}><time dateTime={item.appointment_at}>{item.timeLabel}</time><div><h3>{item.patientName}</h3><p>{item.visitLabel} · {item.reason}</p></div><StatusBadge status={item.status} />{item.patientPath && <Link to={item.patientPath} state={{ appointmentId: item.id, date: item.date }}>View Patient <span aria-hidden="true">→</span></Link>}</li>)}</ul> : <p>No appointments scheduled for today.</p>}</DashboardCard>
  </div>;
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardCard from '../../components/dashboard/DashboardCard.jsx';
import StatusBadge from '../../components/dashboard/StatusBadge.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { staffApiErrorMessage, staffApiService } from '../../services/staffApiService.js';
import { formatBookingDate } from '../../services/dateTimeService.js';
import '../../styles/staff-dashboard.css';

export default function StaffDashboard() {
  const { user } = useAuth(); const [state, setState] = useState({ loading: true, data: null, error: '' });
  const load = async () => { setState((old) => ({ ...old, loading: true, error: '' })); try { setState({ loading: false, data: await staffApiService.getDashboard(), error: '' }); } catch (error) { setState({ loading: false, data: null, error: staffApiErrorMessage(error, 'Unable to load the Staff dashboard.') }); } };
  useEffect(() => { load(); }, []);
  if (state.loading) return <div className="staff-dashboard"><h1>Staff Dashboard</h1><p role="status">Loading today’s clinic operations…</p></div>;
  if (state.error) return <div className="staff-dashboard"><h1>Staff Dashboard</h1><p role="alert">{state.error}</p><button onClick={load}>Try again</button></div>;
  const data = state.data;
  return <div className="staff-dashboard"><header className="staff-title"><div><h1>Staff Dashboard</h1><p>Monitor today’s appointments and patient flow.</p></div><p>{formatBookingDate(data.date)}<br />Arion Health Clinic</p></header>
    <section className="staff-welcome"><h2>Welcome, {user?.display_name ?? 'Staff'}</h2><p>Keep the clinic running smoothly today.</p></section><p className="staff-note">Live clinic data · Philippine time</p>
    <div className="staff-counts">{[["Today’s Appointments",data.total],['Checked-in Patients',data.checkedIn],['Waiting Patients',data.queue.length],['Completed Appointments',data.completed]].map(([label,count])=><section key={label}><h2>{label}</h2><strong>{count}</strong></section>)}</div>
    <div className="staff-overview"><DashboardCard title="Today’s Queue" viewAllTo="/staff/queue" viewAllLabel="View full queue"><p>Urgent → Senior / PWD → Normal. Backend queue order is shown.</p>{data.queue.length ? <ol className="staff-queue">{data.queue.slice(0,5).map(item=><li key={item.id}><div><strong>{item.patientName}</strong><p>{item.timeLabel} · {item.doctorName}</p><small>Checked in at {new Date(item.check_in_at).toLocaleTimeString('en-US',{timeZone:'Asia/Manila',hour:'numeric',minute:'2-digit'})} · Waiting</small></div><div className="staff-badges"><span className={'queue-priority priority-'+item.tier}>{item.priorityLabel}</span><StatusBadge status={item.status} /></div></li>)}</ol> : <p>No patients currently waiting.</p>}</DashboardCard>
    <div><DashboardCard title="Upcoming Appointments" viewAllTo="/staff/calendar" viewAllLabel="View Full Calendar">{data.upcoming.length ? <ul className="staff-upcoming">{data.upcoming.slice(0,4).map(item=><li key={item.id}><strong>{item.timeLabel} · {item.patientName}</strong><p>{item.doctorName} · Not checked in</p><StatusBadge status={item.status} /></li>)}</ul> : <p>No upcoming appointments.</p>}</DashboardCard><section className="staff-tasks"><h2>Quick Staff Tasks</h2><Link className="action-link" to="/staff/queue">Queue / Check-in →</Link><Link className="action-link" to="/staff/patients/new">Register Walk-in →</Link><Link className="action-link" to="/staff/calendar">Full Calendar →</Link></section></div></div>
  </div>;
}

import { Link } from 'react-router-dom';
import DashboardCard from '../../components/dashboard/DashboardCard.jsx';
import StatusBadge from '../../components/dashboard/StatusBadge.jsx';
import { staffDashboardService } from '../../services/staffDashboardService.js';
import { formatBookingDate } from '../../services/bookingService.js';
import '../../styles/staff-dashboard.css';

export default function StaffDashboard() {
  const data = staffDashboardService.getDashboard();
  return <div className="staff-dashboard"><header className="staff-title"><div><h1>Staff Dashboard</h1><p>Monitor today’s appointments and patient flow.</p></div><p>{formatBookingDate(data.date)}<br />Arion Health Clinic</p></header>
    <section className="staff-welcome"><h2>Welcome, Demo Staff</h2><p>Keep the clinic running smoothly today.</p></section><p className="staff-note">Mock snapshot at 10:00 AM · Philippine time</p>
    <div className="staff-counts">{[["Today’s Appointments",data.total],['Checked-in Patients',data.checkedIn],['Waiting Patients',data.waiting.length],['Completed Appointments',data.completed]].map(([label,count])=><section key={label}><h2>{label}</h2><strong>{count}</strong></section>)}</div>
    <div className="staff-overview"><DashboardCard title="Today’s Queue" viewAllTo="/staff/queue" viewAllLabel="View full queue"><p>Urgent → Senior / PWD → Normal. Check-in order applies within each tier.</p>{data.waiting.length ? <ol className="staff-queue">{data.waiting.slice(0,5).map(item=><li key={item.id}><div><strong>{item.patientName}</strong><p>{item.timeLabel} · {item.doctor}</p><small>{item.checkInLabel} at {new Date(item.check_in_at).toLocaleTimeString('en-US',{timeZone:'Asia/Manila',hour:'numeric',minute:'2-digit'})} · Waiting</small></div><div className="staff-badges"><span className={'queue-priority priority-'+item.tier}>{item.priorityLabel}</span><StatusBadge status={item.status} /></div></li>)}</ol> : <p>No patients are waiting.</p>}</DashboardCard>
    <div><DashboardCard title="Upcoming Appointments" viewAllTo="/staff/calendar" viewAllLabel="View Full Calendar">{data.upcoming.length ? <ul className="staff-upcoming">{data.upcoming.slice(0,4).map(item=><li key={item.id}><strong>{item.timeLabel} · {item.patientName}</strong><p>{item.doctor} · {item.checkInLabel}</p><StatusBadge status={item.status} /></li>)}</ul> : <p>No upcoming appointments.</p>}</DashboardCard>
    <section className="staff-tasks"><h2>Quick Staff Tasks</h2><Link className="action-link" to="/staff/queue">Queue / Check-in →</Link><Link className="action-link" to="/staff/patients/new">Register Walk-in →</Link><Link className="action-link" to="/staff/calendar">Full Calendar →</Link></section></div></div>
  </div>;
}

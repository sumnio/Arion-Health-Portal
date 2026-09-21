import { Link } from 'react-router-dom';
import DashboardCard from '../../components/dashboard/DashboardCard.jsx';
import { adminDashboardService } from '../../services/adminDashboardService.js';
import '../../styles/admin-dashboard.css';

export default function AdminDashboard() {
  const data = adminDashboardService.getDashboard();
  return <div className="admin-dashboard">
    <header><h1>Admin Dashboard</h1><p>Welcome, {data.profile.display_name}. Manage doctor and staff accounts.</p></header>
    <div className="admin-totals">
      <section className="admin-total"><span>Total Doctors</span><strong>{data.totalDoctors}</strong><p>Doctor accounts in this mock preview</p><Link className="action-link" to="/admin/doctors">Manage Doctors →</Link></section>
      <section className="admin-total"><span>Total Staff</span><strong>{data.totalStaff}</strong><p>Staff accounts in this mock preview</p><Link className="action-link" to="/admin/staff">Manage Staff →</Link></section>
    </div>
    <div className="admin-account-lists">
      <DashboardCard title="Doctor accounts" viewAllTo="/admin/doctors" viewAllLabel="View doctor accounts"><ul>{data.doctors.slice(0, 5).map(doctor => <li key={doctor.id}><span className="avatar" aria-hidden="true">D</span><div><h3>{doctor.name}</h3><p>{doctor.specialty ?? 'Doctor'}</p></div></li>)}</ul></DashboardCard>
      <DashboardCard title="Staff accounts" viewAllTo="/admin/staff" viewAllLabel="View staff accounts"><ul>{data.staff.slice(0, 5).map(staff => <li key={staff.display_name}><span className="avatar" aria-hidden="true">S</span><div><h3>{staff.display_name}</h3><p>Staff</p></div></li>)}</ul></DashboardCard>
    </div>
  </div>;
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardCard from '../../components/dashboard/DashboardCard.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { adminApiErrorMessage, adminApiService } from '../../services/adminApiService.js';
import '../../styles/admin-dashboard.css';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  async function load() {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try { setState({ loading: false, data: await adminApiService.getDashboard(), error: '' }); }
    catch (error) { setState({ loading: false, data: null, error: adminApiErrorMessage(error, 'Unable to load the Admin dashboard.') }); }
  }
  useEffect(() => { load(); }, []);
  if (state.loading) return <div className="admin-dashboard"><h1>Admin Dashboard</h1><p role="status">Loading account summaries…</p></div>;
  if (state.error) return <div className="admin-dashboard"><h1>Admin Dashboard</h1><p role="alert">{state.error}</p><button className="action-link" onClick={load}>Try again</button></div>;
  const { doctors, staff, patients } = state.data;
  return <div className="admin-dashboard">
    <header><h1>Admin Dashboard</h1><p>Welcome, {user?.display_name ?? 'Admin'}. Manage portal accounts.</p></header>
    <div className="admin-totals">
      <section className="admin-total"><span>Total Doctors</span><strong>{doctors.total}</strong><p>Doctor accounts in the clinic system</p><Link className="action-link" to="/admin/doctors">Manage Doctors →</Link></section>
      <section className="admin-total"><span>Total Staff</span><strong>{staff.total}</strong><p>Staff accounts in the clinic system</p><Link className="action-link" to="/admin/staff">Manage Staff →</Link></section>
      <section className="admin-total"><span>Total Patients</span><strong>{patients.total}</strong><p>Patients, including walk-ins without portal access</p><Link className="action-link" to="/admin/patients">Manage Patient Access →</Link></section>
    </div>
    <div className="admin-account-lists">
      <DashboardCard title="Doctor accounts" viewAllTo="/admin/doctors" viewAllLabel="View doctor accounts">{doctors.items.length ? <ul>{doctors.items.map(doctor => <li key={doctor.id}><span className="avatar" aria-hidden="true">D</span><div><h3>{doctor.display_name}</h3><p>{doctor.specialty}</p></div></li>)}</ul> : <p>No Doctor accounts are available.</p>}</DashboardCard>
      <DashboardCard title="Staff accounts" viewAllTo="/admin/staff" viewAllLabel="View staff accounts">{staff.items.length ? <ul>{staff.items.map(account => <li key={account.id}><span className="avatar" aria-hidden="true">S</span><div><h3>{account.display_name}</h3><p>{account.status}</p></div></li>)}</ul> : <p>No Staff accounts are available.</p>}</DashboardCard>
    </div>
  </div>;
}

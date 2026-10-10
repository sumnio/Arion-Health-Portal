import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { staffApiErrorMessage, staffApiService, staffListPage } from '../../services/staffApiService.js';
import '../../styles/staff-doctors.css';

export default function StaffDoctors() {
  const [state, setState] = useState({ loading: true, doctors: [], error: '' });
  const [page, setPage] = useState(1);
  useEffect(() => {
    let active = true;
    staffApiService.getDoctorDirectory()
      .then(doctors => active && setState({ loading: false, doctors, error: '' }))
      .catch(error => active && setState({ loading: false, doctors: [], error: staffApiErrorMessage(error, 'Unable to load Doctors.') }));
    return () => { active = false; };
  }, []);
  const result = staffListPage(state.doctors, page);
  return <div className="staff-doctors">
    <header className="staff-doctors-heading"><div><h1>Doctors</h1><p>View active Doctors and manage their booking schedules.</p></div></header>
    {state.loading ? <p role="status">Loading Doctors…</p> : state.error ? <p role="alert" className="schedule-error">{state.error}</p> : state.doctors.length ? <><p className="staff-doctor-count" role="status">{state.doctors.length} active {state.doctors.length === 1 ? 'Doctor' : 'Doctors'}</p><ul className="staff-doctor-list">{result.items.map(doctor => <li key={doctor.id} className="staff-doctor-card">
      <div><h2>{doctor.display_name}</h2><p>{doctor.specialty || 'Specialty not provided'}</p></div>
      <dl><div><dt>Today’s appointments</dt><dd>{doctor.todayAppointmentCount}</dd></div><div><dt>Scheduled Today</dt><dd>{doctor.scheduledToday ? 'Yes' : 'No'}</dd></div></dl>
      <Link className="action-link" to={`/staff/doctors/${doctor.id}/schedule`}>Manage Schedule</Link>
    </li>)}</ul>{result.pageCount > 1 && <nav className="staff-doctor-pagination" aria-label="Doctor pages"><button type="button" disabled={result.page === 1} onClick={() => setPage(result.page - 1)}>Previous</button><span>Page {result.page} of {result.pageCount}</span><button type="button" disabled={result.page === result.pageCount} onClick={() => setPage(result.page + 1)}>Next</button></nav>}</> : <div className="staff-doctors-empty"><h2>No active Doctors</h2><p>There are no active Doctors available for schedule management.</p></div>}
  </div>;
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from '../dashboard/StatusBadge.jsx';
import { formatBookingDate } from '../../services/dateTimeService.js';
import { staffApiErrorMessage, staffApiService, staffVisitTypes } from '../../services/staffApiService.js';

const rangeOptions = [['today', 'Today'], ['last_7_days', 'Last 7 Days'], ['last_30_days', 'Last 30 Days'], ['this_month', 'This Month'], ['custom', 'Custom Range']];
const statusOptions = [['all', 'All'], ['completed', 'Completed'], ['cancelled', 'Cancelled'], ['no_show', 'No-show']];
const initialFilters = { range: 'last_30_days', status: 'all', doctorId: 'all', visitType: 'all', from: '', to: '' };
const initialResult = { loading: true, error: '', items: [], total: 0, pageCount: 1 };

function dateTimeLabel(value) {
  if (!value) return null;
  return new Date(value).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function StaffAppointmentHistory() {
  const [filters, setFilters] = useState(initialFilters);
  const [patientInput, setPatientInput] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [page, setPage] = useState(1);
  const [state, setState] = useState(initialResult);
  const requestRef = useRef(0);
  const customError = filters.range === 'custom' ? !filters.from || !filters.to ? 'Choose both From and To dates.' : filters.from > filters.to ? 'From date must be on or before To date.' : '' : '';

  useEffect(() => {
    let active = true;
    staffApiService.getDoctors().then(items => { if (active) setDoctors(items); }).catch(() => { if (active) setDoctors([]); });
    return () => { active = false; };
  }, []);

  const load = useCallback(async () => {
    if (customError) {
      setState(old => ({ ...old, loading: false, error: customError, items: [], total: 0, pageCount: 1 }));
      return;
    }
    const requestId = ++requestRef.current;
    setState(old => ({ ...old, loading: true, error: '' }));
    try {
      const result = await staffApiService.getAppointmentHistory({ ...filters, doctorId: filters.doctorId === 'all' ? '' : filters.doctorId, patientSearch, page });
      if (requestRef.current !== requestId) return;
      if (result.total > 0 && page > result.pageCount) { setPage(result.pageCount); return; }
      setState({ loading: false, error: '', items: result.items, total: result.total, pageCount: result.pageCount });
    } catch (error) {
      if (requestRef.current !== requestId) return;
      setState({ loading: false, error: staffApiErrorMessage(error, 'Unable to load appointment history.'), items: [], total: 0, pageCount: 1 });
    }
  }, [filters, patientSearch, page, customError]);

  useEffect(() => { load(); }, [load]);
  function changeFilter(field, value) { setFilters(old => ({ ...old, [field]: value })); setPage(1); }
  function search(event) { event.preventDefault(); setPatientSearch(patientInput.trim()); setPage(1); }
  const start = state.total ? (page - 1) * 10 + 1 : 0;
  const end = Math.min(page * 10, state.total);

  return <section className="staff-history" aria-labelledby="staff-history-title">
    <div className="history-filters">
      <label>Date Range<select value={filters.range} onChange={event => changeFilter('range', event.target.value)}>{rangeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Status<select value={filters.status} onChange={event => changeFilter('status', event.target.value)}>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Doctor<select value={filters.doctorId} onChange={event => changeFilter('doctorId', event.target.value)}><option value="all">All Doctors</option>{doctors.map(doctor => <option key={doctor.id} value={doctor.id}>{doctor.display_name}</option>)}</select></label>
      <label>Visit Type<select value={filters.visitType} onChange={event => changeFilter('visitType', event.target.value)}><option value="all">All Visit Types</option>{staffVisitTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
      {filters.range === 'custom' && <div className="history-custom-range"><label>From<input type="date" value={filters.from} onChange={event => changeFilter('from', event.target.value)} /></label><label>To<input type="date" value={filters.to} onChange={event => changeFilter('to', event.target.value)} /></label></div>}
      <form className="history-search" role="search" onSubmit={search}><label htmlFor="staff-history-patient">Patient Search</label><div><input id="staff-history-patient" type="search" maxLength="120" value={patientInput} onChange={event => setPatientInput(event.target.value)} placeholder="Search by Patient name" /><button type="submit">Search</button>{patientSearch && <button type="button" onClick={() => { setPatientInput(''); setPatientSearch(''); setPage(1); }}>Clear</button>}</div></form>
    </div>
    <div className="queue-panel history-panel">
      <h2 id="staff-history-title">Appointment History</h2>
      {customError && <p className="history-error" role="alert">{customError}</p>}
      {!customError && state.loading && <p role="status">Loading appointment history…</p>}
      {!customError && !state.loading && state.error && <p className="history-error" role="alert">{state.error} <button type="button" onClick={load}>Try again</button></p>}
      {!customError && !state.loading && !state.error && <>
        <p className="history-result-summary" role="status" aria-live="polite">{state.total} {state.total === 1 ? 'appointment' : 'appointments'} found · Showing {start}–{end} · newest first</p>
        {state.items.length ? <ul className="history-list">{state.items.map(item => <li key={item.id}>
          <div className="history-date"><time dateTime={item.appointment_at}>{formatBookingDate(item.date)}</time><strong>{item.timeLabel}</strong></div>
          <div className="history-main"><div className="history-title-row"><h3>{item.patientName}</h3><StatusBadge status={item.status} /></div><p>{item.doctorName} · {item.visitLabel}</p><p>{item.reason}</p><div className="history-meta">{item.check_in_at && <span>Arrival: {dateTimeLabel(item.check_in_at)}</span>}<span>{item.originLabel}</span><span>Priority: {item.priorityLabel}</span></div>{item.patient_id && <Link className="history-link" to={`/staff/patients/${item.patient_id}`}>View Patient Details →</Link>}</div>
        </li>)}</ul> : <div className="history-empty"><h3>No appointment history found for the selected filters.</h3><p>Try another date range or filter. Existing appointment data has not been changed.</p></div>}
        {state.pageCount > 1 && <nav className="queue-pagination" aria-label="Appointment history pages"><button type="button" disabled={page === 1} onClick={() => setPage(value => Math.max(1, value - 1))}>Previous</button><span>Page {page} of {state.pageCount}</span><button type="button" disabled={page === state.pageCount} onClick={() => setPage(value => Math.min(state.pageCount, value + 1))}>Next</button></nav>}
      </>}
    </div>
  </section>;
}

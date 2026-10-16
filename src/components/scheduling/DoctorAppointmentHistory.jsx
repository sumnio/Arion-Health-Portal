import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from '../dashboard/StatusBadge.jsx';
import { formatBookingDate } from '../../services/dateTimeService.js';
import { doctorApiErrorMessage, doctorApiService } from '../../services/doctorApiService.js';
import { patientVisitTypes } from '../../services/patientApiService.js';

const rangeOptions = [
  ['today', 'Today'],
  ['last_7_days', 'Last 7 Days'],
  ['last_30_days', 'Last 30 Days'],
  ['this_month', 'This Month'],
  ['custom', 'Custom Range'],
];
const statusOptions = [['all', 'All'], ['completed', 'Completed'], ['cancelled', 'Cancelled'], ['no_show', 'No-show']];
const initialFilters = { range: 'last_30_days', status: 'all', visitType: 'all', from: '', to: '' };
const initialResult = { loading: true, error: '', items: [], total: 0, pageCount: 1 };

function arrivalLabel(value) {
  if (!value) return null;
  return new Date(value).toLocaleString('en-US', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function DoctorAppointmentHistory() {
  const [filters, setFilters] = useState(initialFilters);
  const [patientInput, setPatientInput] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [page, setPage] = useState(1);
  const [state, setState] = useState(initialResult);
  const requestRef = useRef(0);
  const customError = filters.range === 'custom'
    ? !filters.from || !filters.to ? 'Choose both From and To dates.'
      : filters.from > filters.to ? 'From date must be on or before To date.' : ''
    : '';

  const load = useCallback(async () => {
    if (customError) {
      setState(old => ({ ...old, loading: false, error: customError, items: [], total: 0, pageCount: 1 }));
      return;
    }
    const requestId = ++requestRef.current;
    setState(old => ({ ...old, loading: true, error: '' }));
    try {
      const result = await doctorApiService.getAppointmentHistory({ ...filters, patientSearch, page });
      if (requestRef.current !== requestId) return;
      if (result.total > 0 && page > result.pageCount) { setPage(result.pageCount); return; }
      setState({ loading: false, error: '', items: result.items, total: result.total, pageCount: result.pageCount });
    } catch (error) {
      if (requestRef.current !== requestId) return;
      setState({ loading: false, error: doctorApiErrorMessage(error, 'Unable to load appointment history.'), items: [], total: 0, pageCount: 1 });
    }
  }, [filters, patientSearch, page, customError]);

  useEffect(() => { load(); }, [load]);

  function changeFilter(field, value) {
    setFilters(old => ({ ...old, [field]: value }));
    setPage(1);
  }

  function search(event) {
    event.preventDefault();
    setPatientSearch(patientInput.trim());
    setPage(1);
  }

  const start = state.total ? (page - 1) * 10 + 1 : 0;
  const end = Math.min(page * 10, state.total);
  return <section className="doctor-history" aria-labelledby="doctor-history-title">
    <div className="history-filters">
      <label>Date Range<select value={filters.range} onChange={event => changeFilter('range', event.target.value)}>{rangeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Status<select value={filters.status} onChange={event => changeFilter('status', event.target.value)}>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Visit Type<select value={filters.visitType} onChange={event => changeFilter('visitType', event.target.value)}><option value="all">All visit types</option>{patientVisitTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
      {filters.range === 'custom' && <div className="history-custom-range"><label>From<input type="date" value={filters.from} onChange={event => changeFilter('from', event.target.value)} /></label><label>To<input type="date" value={filters.to} onChange={event => changeFilter('to', event.target.value)} /></label></div>}
      <form className="history-search" role="search" onSubmit={search}><label htmlFor="doctor-history-patient">Patient Search</label><div><input id="doctor-history-patient" type="search" maxLength="120" value={patientInput} onChange={event => setPatientInput(event.target.value)} placeholder="Search by Patient name" /><button type="submit">Search</button>{patientSearch && <button type="button" onClick={() => { setPatientInput(''); setPatientSearch(''); setPage(1); }}>Clear</button>}</div></form>
    </div>
    <div className="schedule-panel history-panel">
      <h2 id="doctor-history-title">History</h2>
      {customError && <p className="availability-error" role="alert">{customError}</p>}
      {!customError && state.loading && <p role="status">Loading appointment history…</p>}
      {!customError && !state.loading && state.error && <p className="availability-error" role="alert">{state.error} <button type="button" onClick={load}>Try again</button></p>}
      {!customError && !state.loading && !state.error && <>
        <p className="history-result-summary" role="status" aria-live="polite">{state.total} {state.total === 1 ? 'appointment' : 'appointments'} found · Showing {start}–{end} · newest first</p>
        {state.items.length ? <ul className="history-list">{state.items.map(item => <li key={item.id}>
          <div className="history-date"><time dateTime={item.appointment_at}>{formatBookingDate(item.date)}</time><strong>{item.timeLabel}</strong></div>
          <div className="history-main"><div className="history-title-row"><h3>{item.patientName}</h3><StatusBadge status={item.status} /></div><p>{item.visitLabel} · {item.reason}</p>{item.check_in_at && <p className="history-arrival">Arrival confirmed: {arrivalLabel(item.check_in_at)}</p>}{item.patientPath ? <div className="history-actions"><Link to={item.patientPath} state={{ appointmentId: item.id, date: item.date, source: 'schedule' }}>View Patient →</Link>{item.medical_record_id && <Link to={item.patientPath} state={{ appointmentId: item.id, date: item.date, tab: 'records', recordId: item.medical_record_id, source: 'schedule' }}>View Medical Record →</Link>}</div> : <p className="history-arrival">Patient unavailable</p>}</div>
        </li>)}</ul> : <div className="schedule-empty"><h3>No appointment history found for the selected filters.</h3><p>Try another date range or filter. Existing appointment data has not been changed.</p></div>}
        {state.pageCount > 1 && <nav className="doctor-list-pagination" aria-label="Appointment history pages"><button type="button" disabled={page === 1} onClick={() => setPage(value => Math.max(1, value - 1))}>Previous</button><span>Page {page} of {state.pageCount}</span><button type="button" disabled={page === state.pageCount} onClick={() => setPage(value => Math.min(state.pageCount, value + 1))}>Next</button></nav>}
      </>}
    </div>
  </section>;
}

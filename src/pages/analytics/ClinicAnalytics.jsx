import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext.jsx';
import { analyticsErrorMessage, analyticsPeriods, analyticsService } from '../../services/analyticsService.js';
import { formatSlot } from '../../services/dateTimeService.js';
import '../../styles/clinic-analytics.css';

const summaryCards = [
  ['total_appointments', 'Total Appointments'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
  ['no_show', 'No-show'],
  ['pending', 'Pending'],
  ['confirmed', 'Confirmed'],
];
const statusLabels = { pending: 'Pending', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No-show' };

function displayKey(value) {
  return value.split('_').map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' ');
}

function MetricBars({ items, labelFor = displayKey, empty = 'No activity in this period.' }) {
  const visible = items.filter((item) => item.count > 0);
  const maximum = Math.max(...visible.map((item) => item.count), 1);
  if (!visible.length) return <p className="analytics-empty">{empty}</p>;
  return <ul className="analytics-bars">{visible.map((item) => <li key={item.key}>
    <div><span>{labelFor(item.key)}</span><strong>{item.count}</strong></div>
    <span className="analytics-track" aria-hidden="true"><span style={{ width: `${Math.max((item.count / maximum) * 100, 4)}%` }} /></span>
  </li>)}</ul>;
}

function PeriodRange({ period }) {
  const end = new Date(`${period.end_date_exclusive}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() - 1);
  return <p className="analytics-range">{period.start_date} through {end.toISOString().slice(0, 10)} · {period.time_zone}</p>;
}

export default function ClinicAnalytics() {
  const { user } = useAuth();
  const [period, setPeriod] = useState('today');
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  const requestId = useRef(0);
  const load = useCallback(async () => {
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const data = await analyticsService.getAnalytics(user.role, period);
      if (requestId.current === currentRequest) setState({ loading: false, data, error: '' });
    } catch (error) {
      if (requestId.current === currentRequest) setState({ loading: false, data: null, error: analyticsErrorMessage(error) });
    }
  }, [period, user.role]);
  useEffect(() => {
    load();
    return () => { requestId.current += 1; };
  }, [load]);

  return <div className="clinic-analytics">
    <header className="analytics-header"><div><h1>Analytics</h1><p>Read-only clinic operational activity. Metrics use scheduled appointment times.</p></div>
      <div className="analytics-period" aria-label="Analytics period">{analyticsPeriods.map((item) => <button key={item.key} type="button" aria-pressed={period === item.key} onClick={() => setPeriod(item.key)}>{item.label}</button>)}</div>
    </header>
    {state.loading ? <p role="status">Loading clinic analytics…</p> : state.error ? <section className="analytics-message"><p role="alert">{state.error}</p><button type="button" onClick={load}>Try again</button></section> : <AnalyticsContent data={state.data} />}
  </div>;
}

function AnalyticsContent({ data }) {
  const hasActivity = data.summary.total_appointments > 0;
  return <>
    <PeriodRange period={data.period} />
    <section className="analytics-summary" aria-label="Appointment summary">{summaryCards.map(([key, label]) => <article key={key}><span>{label}</span><strong>{data.summary[key]}</strong></article>)}</section>
    {!hasActivity && <p className="analytics-empty analytics-period-empty">No appointments were scheduled in this period.</p>}
    <div className="analytics-grid">
      <section className="analytics-card analytics-wide"><h2>Doctor Workload</h2><p>Appointment counts are operational volume, not performance scores. Patients served are unique Patients with completed appointments.</p>
        <div className="analytics-table-wrap"><table aria-label="Doctor workload metrics"><thead><tr><th scope="col">Doctor</th><th scope="col">Appointments</th><th scope="col">Unique Patients</th><th scope="col">Patients Served</th><th scope="col">Completed</th><th scope="col">Cancelled</th><th scope="col">No-show</th><th scope="col">Urgent</th></tr></thead><tbody>{data.doctor_workload.map((doctor, index) => <tr key={`${doctor.doctor_name}-${index}`}><th scope="row">{doctor.doctor_name}</th><td>{doctor.total_appointments}</td><td>{doctor.unique_patients}</td><td>{doctor.patients_served}</td><td>{doctor.completed}</td><td>{doctor.cancelled}</td><td>{doctor.no_show}</td><td>{doctor.urgent}</td></tr>)}</tbody></table></div>
        {!data.doctor_workload.length && <p className="analytics-empty">No active Doctors are available.</p>}
      </section>
      <section className="analytics-card"><h2>Appointments per Doctor</h2><p>This chart counts appointments, not Patients.</p><MetricBars items={data.doctor_workload.map((item) => ({ key: item.doctor_name, count: item.total_appointments }))} labelFor={(value) => value} /></section>
      <section className="analytics-card"><h2>Appointment Status Breakdown</h2><MetricBars items={data.status_breakdown} labelFor={(value) => statusLabels[value] ?? value} /></section>
      <section className="analytics-card"><h2>Visit Types</h2><p>Labels retain the stored visit-type value.</p><MetricBars items={data.visit_types} labelFor={(value) => <><span>{displayKey(value)}</span> <code>{value}</code></>} /></section>
      <section className="analytics-card"><h2>Visit Reasons</h2><p>Non-standard and free-text reasons are grouped without exposing their text.</p><MetricBars items={data.visit_reasons} labelFor={(value) => value} /></section>
      <section className="analytics-card"><h2>Urgent Cases</h2><strong className="analytics-feature-number">{data.urgent.appointments}</strong><p>Appointments currently marked Urgent within this scheduled period.</p></section>
      <section className="analytics-card"><h2>Senior / PWD Service Volume</h2><p>{data.senior_pwd.metric}.</p><dl className="analytics-facts"><div><dt>Senior</dt><dd>{data.senior_pwd.senior}</dd></div><div><dt>PWD</dt><dd>{data.senior_pwd.pwd}</dd></div><div><dt>Combined, no double-counting</dt><dd>{data.senior_pwd.combined}</dd></div></dl></section>
      <section className="analytics-card"><h2>Busiest Day</h2>{data.busiest_day ? <><strong className="analytics-feature-text">{data.busiest_day.key}</strong><p>{data.busiest_day.count} scheduled appointment{data.busiest_day.count === 1 ? '' : 's'}</p></> : <p className="analytics-empty">No scheduled appointments in this period.</p>}</section>
      <section className="analytics-card"><h2>Busiest Time</h2>{data.busiest_time ? <><strong className="analytics-feature-text">{formatSlot(data.busiest_time.key)}</strong><p>{data.busiest_time.count} appointment{data.busiest_time.count === 1 ? '' : 's'} at this 30-minute scheduled slot</p></> : <p className="analytics-empty">No scheduled appointments in this period.</p>}</section>
    </div>
  </>;
}

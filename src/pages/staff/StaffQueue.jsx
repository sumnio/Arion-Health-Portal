import { useState } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from '../../components/dashboard/StatusBadge.jsx';
import { staffQueueService, queueActions } from '../../services/staffQueueService.js';
import { formatBookingDate } from '../../services/bookingService.js';
import '../../styles/staff-queue.css';

const time = value => value ? new Date(value).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' }) : 'Not checked in';
export default function StaffQueue() {
  const [, refresh] = useState(0);
  const [selectedId, select] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const data = staffQueueService.getQueue();
  const selected = data.appointments.find(item => item.id === selectedId);
  const actions = queueActions(selected);
  function act(action) {
    try {
      staffQueueService.act(selected.id, action);
      setMessage(`${selected.patientName}: ${action === 'checkIn' ? 'checked in and added to the waiting queue' : 'appointment marked no-show'}. Mock state updated.`);
      setError(''); setConfirmation(null); refresh(value => value + 1);
    } catch (err) { setError(err.message); setConfirmation(null); }
  }
  function section(title, items, empty, waiting = false) {
    return <section className="queue-panel" aria-label={title}><h2>{title} <span>({items.length})</span></h2>{items.length ? <ol className="queue-list">{items.map((item, index) => <li key={item.id}>
      <button className="queue-patient" aria-pressed={selectedId === item.id} onClick={() => { select(item.id); setConfirmation(null); setError(''); }}>
        <span className="queue-person">{waiting && <span className="queue-position">{index + 1}</span>}<strong>{item.patientName}</strong><span>{item.timeLabel} · {item.doctor}</span></span>
        <span className="queue-labels"><span className={'badge priority-' + item.tier}>{item.priorityLabel}</span><StatusBadge status={item.status} /><span>{waiting ? 'Waiting · ' : ''}{time(item.check_in_at)}</span><span className="queue-view">View details →</span></span>
      </button>
    </li>)}</ol> : <p className="queue-empty">{empty}</p>}</section>;
  }
  return <div className="staff-queue">
    <header className="queue-heading"><div><h1>Queue / Check-in</h1><p>Manage today’s waiting patients and check-in flow.</p></div><p>{formatBookingDate(data.date)}<br />Arion Health Clinic</p></header>
    <nav className="queue-links" aria-label="Queue shortcuts"><Link className="action-link" to="/staff/calendar">Full Calendar</Link><Link className="action-link" to="/staff/patients/new">Register Walk-in</Link></nav>
    <div className="queue-counts">{[['Waiting patients', data.waiting.length], ['Checked in', data.checkedIn], ['Urgent / Senior / PWD waiting', data.waiting.filter(item => item.tier < 2).length]].map(([label, count]) => <div className="queue-panel" key={label}><span>{label}</span><strong>{count}</strong></div>)}</div>
    <p className="queue-note">Philippine time · Mock session only. Check-in uses the current time. No-show is available only once the appointment time has passed. Reload resets changes.</p>
    <p role="status">{message}</p>{error && <p role="alert">{error}</p>}
    <div className="queue-layout"><div className="queue-sections">
      {section('Waiting queue', data.waiting, 'No patients are waiting. Checked-in patients will appear here.', true)}
      {section('Not checked in', data.notCheckedIn, 'No eligible check-ins remaining today.')}
      {section('Completed / Cancelled / No-show', data.finished, 'No completed, cancelled, or no-show appointments today.')}
    </div><aside className="queue-panel queue-details" aria-label="Selected appointment"><h2>Selected appointment</h2>{selected ? <>
      <h3>{selected.patientName}</h3><StatusBadge status={selected.status} /><dl><dt>Appointment time</dt><dd>{selected.timeLabel}</dd><dt>Doctor</dt><dd>{selected.doctor}</dd><dt>Check-in time</dt><dd>{time(selected.check_in_at)}</dd><dt>Queue priority</dt><dd>{selected.priorityLabel}</dd></dl>
      <div className="queue-actions">{actions.checkIn && <button onClick={() => act('checkIn')}>Check In</button>}{actions.noShow && <button onClick={() => setConfirmation('noShow')}>Mark No-show</button>}</div>
      {confirmation && <div className="queue-confirm"><p>Confirm this patient did not attend the scheduled appointment.</p><button onClick={() => act(confirmation)}>Confirm no-show</button><button onClick={() => setConfirmation(null)}>Keep current status</button></div>}
      {!actions.checkIn && !actions.noShow && <p>This appointment is view-only. The assigned doctor completes the consultation after saving its medical record.</p>}
    </> : <p>Select a patient to view operational details and available actions.</p>}
      <div className="queue-reminder"><h3>Queue priority</h3><p>Urgent → Senior / PWD → Normal.</p><p>Within each tier, earlier check-in comes first. Senior priority is derived from date of birth; PWD comes from patient information.</p></div>
    </aside></div>
  </div>;
}

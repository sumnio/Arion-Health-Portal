import { Link } from 'react-router-dom';
import { staffQueueService } from '../../services/staffQueueService.js';
export default function WalkInQueuePreview() {
  const queue = staffQueueService.getQueue();
  return <aside className="walkin-panel"><h2>Today’s queue</h2><p>{queue.waiting.length} waiting patients</p>{queue.waiting.length ? <ol className="walkin-queue">{queue.waiting.slice(0, 5).map(item => <li key={item.id}><strong>{item.patientName}</strong><span>{item.timeLabel} · {item.doctor}</span><span className="badge">{item.priorityLabel}</span></li>)}</ol> : <p>No patients waiting.</p>}<Link className="action-link" to="/staff/queue">Queue / Check-in</Link><p>Register or select a patient, create a same-day appointment, then check in.</p></aside>;
}

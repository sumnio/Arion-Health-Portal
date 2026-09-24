import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import FormField from '../../components/public/FormField.jsx';
import StatusBadge from '../../components/dashboard/StatusBadge.jsx';
import WalkInQueuePreview from '../../components/staff/WalkInQueuePreview.jsx';
import { staffWalkInService, isSenior, formatSlot } from '../../services/staffWalkInService.js';
import { staffQueueService } from '../../services/staffQueueService.js';
import { formatBookingDate } from '../../services/bookingService.js';
import '../../styles/staff-walkin.css';

export default function StaffWalkInAppointment() {
  const { id } = useParams();
  return <WalkInAppointment key={id} patientId={id} />;
}
function WalkInAppointment({ patientId }) {
  const navigate = useNavigate();
  const [submissionId] = useState(() => crypto.randomUUID());
  const [date] = useState(() => staffWalkInService.options().date);
  const [values, setValues] = useState({ doctor: '', service: '', time: '', reason: '', priority: 'normal' });
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(null);
  const patient = staffWalkInService.getPatient(patientId);
  const options = staffWalkInService.options();
  const doctor = options.doctors.find(item => item.id === values.doctor);
  if (!patient) return <div className="staff-walkin walkin-panel"><h1>Patient not found</h1><p>This patient is not available in the current mock session.</p><Link className="action-link" to="/staff/patients/new">Find or register a patient</Link></div>;
  function submit(event) {
    event.preventDefault(); if (saved) return;
    const result = staffWalkInService.createAppointment(patientId, { ...values, date }, submissionId);
    setErrors(result.errors ?? {}); if (result.appointment) setSaved(result.appointment);
  }
  function checkIn() {
    try { staffQueueService.act(saved.id, 'checkIn'); navigate('/staff/queue'); }
    catch (error) { setErrors({ form: error.message }); }
  }
  if (saved) return <div className="staff-walkin walkin-panel"><h1>Walk-in appointment created</h1><p role="status">{patient.full_name}’s appointment is saved in this mock session.</p><StatusBadge status={saved.status} /><p>{formatBookingDate(saved.appointment_at.slice(0, 10))} · {formatSlot(saved.appointment_at.slice(11, 16))}</p><p>Ready for check-in. No portal account was created.</p>{errors.form && <p role="alert">{errors.form}</p>}<div className="walkin-actions"><button onClick={checkIn}>Check In and Open Queue</button><Link className="action-link" to="/staff/calendar">Full Calendar</Link><Link className="action-link" to="/staff/queue">Queue / Check-in</Link></div></div>;
  return <div className="staff-walkin"><Link to="/staff/patients/new">← Find or register a patient</Link><h1>Create Walk-in Appointment</h1><p>Same-day appointment · {formatBookingDate(date)} · Philippine time · 10:00 AM mock availability snapshot</p><div className="walkin-layout"><div>
    <section className="walkin-panel"><h2>Patient information</h2><h3>{patient.full_name}</h3><p>{patient.dob} · {patient.sex} · {patient.contact_number}</p><p>Senior: {isSenior(patient.dob) ? 'Yes' : 'No'} (derived from DOB) · PWD: {patient.is_pwd ? 'Yes' : 'No'}</p><p>Using the selected patient’s existing ID. Patient information is read-only here.</p></section>
    <form className="walkin-panel" onSubmit={submit} noValidate><h2>Visit details</h2><p>All fields below are required.</p>{Object.keys(errors).length > 0 && <ul role="alert" className="walkin-error">{Object.entries(errors).map(([key, message]) => <li key={key}>{message}</li>)}</ul>}
      {!options.doctors.length && <p role="status">No doctors have available same-day slots. Check the Full Calendar or return later.</p>}
      <div className="walkin-fields"><FormField name="walkin-doctor" label="Doctor" value={values.doctor} onChange={event => setValues({ ...values, doctor: event.target.value, time: '' })}><option value="">Select an available doctor</option>{options.doctors.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</FormField>
      <FormField name="walkin-service" label="Visit type / service" value={values.service} onChange={event => setValues({ ...values, service: event.target.value })}><option value="">Select visit type</option>{options.services.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</FormField>
      <FormField name="walkin-slot" label="Available same-day time" value={values.time} disabled={!doctor} onChange={event => setValues({ ...values, time: event.target.value })}><option value="">Select time</option>{doctor?.slots.map(time => <option key={time} value={time}>{formatSlot(time)}</option>)}</FormField>
      <FormField name="walkin-priority" label="Appointment priority" value={values.priority} onChange={event => setValues({ ...values, priority: event.target.value })}><option value="normal">Normal</option><option value="urgent">Urgent</option></FormField></div>
      <label className="walkin-reason">Reason for visit<textarea value={values.reason} onChange={event => setValues({ ...values, reason: event.target.value })} rows={3} /></label><p>Senior/PWD queue priority is derived from patient information.</p>
      <div className="walkin-actions"><Link className="action-link" to="/staff/patients/new">Cancel</Link><button type="submit" disabled={!options.doctors.length}>Create Walk-in Appointment</button></div>
    </form></div><WalkInQueuePreview /></div></div>;
}

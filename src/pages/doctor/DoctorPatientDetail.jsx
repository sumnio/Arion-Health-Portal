import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import ConsultationHistory from '../../components/records/ConsultationHistory.jsx';
import RecordSection from '../../components/records/RecordSection.jsx';
import StatusBadge from '../../components/dashboard/StatusBadge.jsx';
import { doctorApiErrorMessage, doctorApiService } from '../../services/doctorApiService.js';
import { patientAge, patientIsSenior } from '../../services/patientApiService.js';
import { formatBookingDate } from '../../services/dateTimeService.js';
import '../../styles/doctor-patient.css';

const tabs = [
  ['overview', 'Overview'],
  ['consultation', 'Consultation'],
  ['records', 'Medical Records'],
  ['certificates', 'Certificates'],
];

export default function DoctorPatientDetail() {
  const { id } = useParams();
  const { state: selection } = useLocation();
  const initialTab = tabs.some(([key]) => key === selection?.tab) ? selection.tab : 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [state, setState] = useState({ loading: true, detail: null, error: '' });
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const load = useCallback(async () => {
    setState((old) => ({ ...old, loading: true, error: '' }));
    try {
      const detail = await doctorApiService.getPatientContext(id, selection ?? {});
      setState({ loading: false, detail, error: detail ? '' : 'Patient or assigned appointment not found.' });
    } catch (error) {
      setState({ loading: false, detail: null, error: doctorApiErrorMessage(error, 'Patient or assigned appointment not found.') });
    }
  }, [id, selection?.appointmentId]);
  useEffect(() => { load(); }, [load]);
  const backTarget = selection?.source === 'patients' ? '/doctor/patients' : '/doctor/schedule';
  const backLabel = selection?.source === 'patients' ? 'Back to Patients' : 'Back to Schedule';
  const back = <Link className="detail-back" to={backTarget}>← {backLabel}</Link>;

  async function completeConsultation() {
    setSubmitting(true); setMessage('');
    try {
      await doctorApiService.completeAppointment(state.detail.appointment.id);
      await load();
      setMessage('Consultation marked completed. The appointment status was refreshed from the server.');
      setConfirming(false);
    } catch (error) {
      setMessage(doctorApiErrorMessage(error, 'Unable to complete this consultation.'));
    } finally { setSubmitting(false); }
  }

  if (state.loading) return <div className="doctor-patient-page">{back}<p role="status">Loading patient consultation…</p></div>;
  if (state.error || !state.detail) return <div className="doctor-patient-page">{back}<RecordSection title="Patient or appointment not found"><p role="alert">{state.error}</p></RecordSection></div>;

  const { patient, appointment, priorityHistory, existingRecord, canAddRecord, canComplete, consultationMessage, records, certificates } = state.detail;
  const age = patientAge(patient.dob); const senior = patientIsSenior(patient.dob);
  return <div className="doctor-patient-page">{back}
    <header className="detail-heading"><div><h1>{patient.full_name}</h1><p>{formatBookingDate(appointment.date)} · {appointment.timeLabel} · Philippine time</p></div><StatusBadge status={appointment.status} /></header>
    <nav className="patient-detail-tabs" role="tablist" aria-label="Patient details">
      {tabs.map(([key, label]) => <button key={key} id={`patient-tab-${key}`} type="button" role="tab" aria-selected={activeTab === key} aria-controls={`patient-panel-${key}`} onClick={() => setActiveTab(key)}>{label}</button>)}
    </nav>
    <section id={`patient-panel-${activeTab}`} className="patient-tab-panel" role="tabpanel" aria-labelledby={`patient-tab-${activeTab}`}>
      {activeTab === 'overview' && <div className="doctor-patient-grid"><RecordSection title="Patient Information"><strong className="patient-name">{patient.full_name}</strong><p>{age == null ? 'Age unavailable' : `${age} years old`} · {patient.sex}</p><dl><div><dt>Date of birth</dt><dd>{formatBookingDate(patient.dob)}</dd></div><div><dt>Contact number</dt><dd>{patient.contact_number}</dd></div><div><dt>Allergies</dt><dd>{patient.allergies?.length ? patient.allergies.join(', ') : 'No known allergies reported'}</dd></div><div><dt>PWD status</dt><dd>{patient.is_pwd ? 'PWD' : 'Not a PWD'}</dd></div><div><dt>Senior status</dt><dd>{senior ? 'Senior citizen' : 'Not a senior citizen'} (based on date of birth)</dd></div></dl></RecordSection>
        <div><RecordSection title="Current Appointment"><dl><div><dt>Date</dt><dd>{formatBookingDate(appointment.date)}</dd></div><div><dt>Time</dt><dd>{appointment.timeLabel} · Philippine time</dd></div><div><dt>Status</dt><dd><StatusBadge status={appointment.status} /></dd></div><div><dt>Arrival</dt><dd>{appointment.check_in_at ? `Confirmed ${new Date(appointment.check_in_at).toLocaleString('en-US', { timeZone: 'Asia/Manila' })}` : 'Not checked in'}</dd></div><div><dt>Priority</dt><dd>{appointment.priority === 'urgent' ? 'Urgent' : senior || patient.is_pwd ? 'Senior / PWD priority (derived)' : 'Normal'}</dd></div><div><dt>Visit type</dt><dd>{appointment.visitLabel}</dd></div><div><dt>Reason</dt><dd>{appointment.reason}</dd></div></dl></RecordSection>
          {priorityHistory.length > 0 && <RecordSection title="Urgency History"><ol className="priority-audit-list">{priorityHistory.map(item => <li key={item.id}><strong>{item.previous_priority === 'urgent' ? 'Urgent' : 'Normal'} → {item.new_priority === 'urgent' ? 'Urgent' : 'Normal'}</strong><span>{item.urgency_reason || item.correction_reason}{item.explanation ? ` — ${item.explanation}` : ''}</span><time dateTime={item.changed_at}>{new Date(item.changed_at).toLocaleString('en-US', { timeZone: 'Asia/Manila' })}</time></li>)}</ol></RecordSection>}
        </div></div>}
      {activeTab === 'consultation' && <RecordSection title="Consultation"><p>{consultationMessage}</p>{existingRecord && <p><strong>Saved diagnosis:</strong> {existingRecord.diagnosis}</p>}{message && <p role={message.startsWith('Consultation marked') ? 'status' : 'alert'}>{message}</p>}{canAddRecord && <Link className="action-link primary-action" to={`/doctor/patients/${id}/add-record`} state={{ appointmentId: appointment.id, date: appointment.date, tab: 'consultation' }}>Add Medical Record</Link>}{canComplete && !confirming && <button className="action-link primary-action" onClick={() => setConfirming(true)}>Mark Consultation Completed</button>}{canComplete && confirming && <div className="completion-confirm"><p>Confirm that the consultation is finished. The saved medical record will remain read-only.</p><button disabled={submitting} onClick={completeConsultation}>{submitting ? 'Completing…' : 'Confirm Completion'}</button><button disabled={submitting} onClick={() => setConfirming(false)}>Keep Confirmed</button></div>}</RecordSection>}
      {activeTab === 'records' && <ConsultationHistory key={`${id}-records-${records.length}`} records={records} certificates={certificates} section="records" />}
      {activeTab === 'certificates' && <ConsultationHistory key={`${id}-certificates-${certificates.length}`} records={records} certificates={certificates} section="certificates" />}
    </section>
  </div>;
}

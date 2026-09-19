import ConsultationHistory from '../../components/records/ConsultationHistory.jsx';
import { doctorHistoryService } from '../../services/doctorHistoryService.js';
import { Link, useLocation, useParams } from 'react-router-dom';
import RecordSection from '../../components/records/RecordSection.jsx';
import StatusBadge from '../../components/dashboard/StatusBadge.jsx';
import { doctorPatientService } from '../../services/doctorPatientService.js';
import { formatBookingDate } from '../../services/bookingService.js';
import '../../styles/doctor-patient.css';

export default function DoctorPatientDetail() {
  const { id } = useParams();
  const { state } = useLocation();
  const detail = doctorPatientService.get(id, state);
  const back = <Link className="detail-back" to="/doctor/schedule">← Back to Schedule</Link>;
  if (!detail) return <div className="doctor-patient-page">{back}<RecordSection title="Patient or appointment not found"><p>The selected mock patient or appointment is unavailable. Return to your schedule to select a patient.</p></RecordSection></div>;
  const { patient, appointment, existingRecord, canAddRecord, consultationMessage } = detail;
  const clinicalHistory = doctorHistoryService.get(id, state);
  return <div className="doctor-patient-page">{back}
    <header className="detail-heading"><div><h1>Patient Details</h1><p>Review patient information and visit details.</p></div><StatusBadge status={appointment.status} /></header>
    <div className="doctor-patient-grid"><div>
      <RecordSection title="Patient Information"><h3>{patient.name}</h3><p>{patient.age} years old · {patient.sex}</p><dl>
        <div><dt>Date of birth</dt><dd>{formatBookingDate(patient.dob)}</dd></div>
        <div><dt>Contact number</dt><dd>{patient.contact_number}</dd></div>
        <div><dt>Allergies</dt><dd>{patient.allergies.length ? patient.allergies.join(', ') : 'No known allergies reported'}</dd></div>
        <div><dt>PWD status</dt><dd>{patient.is_pwd ? 'PWD' : 'Not a PWD'}</dd></div>
        <div><dt>Senior status</dt><dd>{patient.senior ? 'Senior citizen' : 'Not a senior citizen'} (based on date of birth)</dd></div>
      </dl></RecordSection>
      <ConsultationHistory key={id} records={clinicalHistory.records} certificates={clinicalHistory.certificates} />
    </div><div>
      <RecordSection title="Current Appointment"><dl><div><dt>Date</dt><dd>{formatBookingDate(appointment.appointment_at.slice(0, 10))}</dd></div><div><dt>Time</dt><dd>{appointment.timeLabel} · Philippine time</dd></div><div><dt>Status</dt><dd><StatusBadge status={appointment.status} /></dd></div><div><dt>Priority</dt><dd>{patient.senior || patient.is_pwd ? "Senior / PWD priority (derived)" : "Normal"}</dd></div><div><dt>Visit / reason</dt><dd>{appointment.reason}</dd></div></dl></RecordSection>
      <RecordSection title="Consultation"><p>{consultationMessage}</p>{existingRecord && <p><strong>{existingRecord.diagnosis}</strong></p>}{canAddRecord && <Link className="action-link primary-action" to={`/doctor/patients/${id}/add-record`} state={{ appointmentId: appointment.id, date: appointment.appointment_at.slice(0, 10) }}>Add Medical Record</Link>}</RecordSection>
    </div></div>
  </div>;
}

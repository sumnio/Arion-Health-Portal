import { useState } from 'react';
import { Link } from 'react-router-dom';
import DateTile from '../../components/dashboard/DateTile.jsx';
import RecordSection from '../../components/records/RecordSection.jsx';
import { medicalRecordService, formatEncounter } from '../../services/medicalRecordService.js';
import '../../styles/patient-records.css';

export default function PatientRecords() {
  const [query, setQuery] = useState('');
  const records = medicalRecordService.list(query);
  return <div className="patient-records">
    <header className="records-heading"><h1>My Records</h1><p>View your medical visit history, diagnoses, and prescriptions from Arion Health Clinic.</p></header>
    <div className="records-layout"><div>
      <div className="record-search"><label htmlFor="record-search">Search medical records</label><input id="record-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by doctor, diagnosis, or visit type…" /></div>
      <p className="record-count" role="status">{records.length} {records.length === 1 ? 'record' : 'records'} · Most recent first</p>
      <div className="record-list">{records.map(record => <article className="record-card record-list-item" key={record.id}>
        <DateTile value={record.encounter_at} />
        <div className="record-list-copy"><h2>{record.visitType}</h2><p><strong>{record.doctor}</strong><br />{record.specialty}</p><p className="record-diagnosis-preview">{record.diagnosis}</p></div>
        <Link className="action-link" to={'/patient/records/' + record.id} aria-label={'View Record for ' + formatEncounter(record.encounter_at)}>View Record <span aria-hidden="true">→</span></Link>
      </article>)}</div>
      {!records.length && <RecordSection title="No records found"><p>Try another doctor, diagnosis, or visit type.</p><button type="button" className="action-link" onClick={() => setQuery('')}>Clear Search</button></RecordSection>}
    </div><aside><RecordSection title="Your Health Records"><p>These records were created at Arion Health Clinic. Patients can view their records here.</p><p>If you have questions about a record, ask your clinic during your next visit.</p><p className="record-mock-note">Mock medical records for demonstration only.</p></RecordSection></aside></div>
  </div>;
}

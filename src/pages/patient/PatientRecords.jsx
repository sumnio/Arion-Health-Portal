import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DateTile from '../../components/dashboard/DateTile.jsx';
import RecordSection from '../../components/records/RecordSection.jsx';
import { formatEncounter } from '../../services/dateTimeService.js';
import { patientApiErrorMessage, patientApiService } from '../../services/patientApiService.js';
import '../../styles/patient-records.css';

export default function PatientRecords() {
  const [items, setItems] = useState(null); const [query, setQuery] = useState(''); const [error, setError] = useState('');
  useEffect(() => { patientApiService.getRecords().then(setItems).catch(reason => setError(patientApiErrorMessage(reason, 'Medical records were not found.'))); }, []);
  if (error) return <RecordSection title="Unable to load medical records"><p role="alert">{error}</p></RecordSection>;
  if (!items) return <RecordSection title="Loading medical records"><p aria-live="polite">Please wait…</p></RecordSection>;
  const search = query.trim().toLowerCase(); const records = items.filter(record => [record.doctor, record.diagnosis, record.visitType].some(value => value?.toLowerCase().includes(search))).sort((a, b) => new Date(b.encounter_at) - new Date(a.encounter_at));
  return <div className="patient-records"><header className="records-heading"><h1>My Records</h1><p>View your medical visit history from Arion Health Clinic.</p></header><div className="records-layout"><div><div className="record-search"><label htmlFor="record-search">Search medical records</label><input id="record-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by doctor, diagnosis, or visit type…" /></div><p className="record-count" role="status">{records.length} {records.length === 1 ? 'record' : 'records'} · Most recent first</p><div className="record-list">{records.map(record => <article className="record-card record-list-item" key={record.id}><DateTile value={record.encounter_at} /><div className="record-list-copy"><h2>{record.visitType}</h2><p><strong>{record.doctor}</strong><br />{record.specialty}</p><p className="record-diagnosis-preview">{record.diagnosis}</p></div><Link className="action-link" to={'/patient/records/' + record.id}>View Record →</Link></article>)}</div>{!items.length && <RecordSection title="No medical records yet"><p>Records created by your doctor will appear here.</p></RecordSection>}{items.length > 0 && !records.length && <RecordSection title="No records found"><p>Try another doctor, diagnosis, or visit type.</p><button type="button" className="action-link" onClick={() => setQuery('')}>Clear Search</button></RecordSection>}</div><aside><RecordSection title="Your Health Records"><p>These records were created at Arion Health Clinic and are read-only.</p></RecordSection></aside></div></div>;
}

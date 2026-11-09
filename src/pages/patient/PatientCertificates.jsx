import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DateTile from '../../components/dashboard/DateTile.jsx';
import StatusBadge from '../../components/dashboard/StatusBadge.jsx';
import CertificatePdfButton from '../../components/certificates/CertificatePdfButton.jsx';
import { formatCertificateDate } from '../../services/dateTimeService.js';
import { patientApiErrorMessage, patientApiService } from '../../services/patientApiService.js';
import '../../styles/patient-certificates.css';

export default function PatientCertificates() {
  const [view, setView] = useState('active');
  const [pages, setPages] = useState({ active: 1, archived: 1 });
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const page = pages[view];
  const load = useCallback(() => {
    let current = true;
    setStatus('loading'); setError('');
    patientApiService.getCertificates({ view, page }).then(value => {
      if (current) { setResult(value); setStatus('ready'); }
    }).catch(reason => {
      if (current) { setError(patientApiErrorMessage(reason, 'Certificates were not found.')); setStatus('error'); }
    });
    return () => { current = false; };
  }, [view, page]);
  useEffect(load, [load]);
  const selectView = (nextView) => { setView(nextView); document.getElementById(`certificate-tab-${nextView}`)?.focus(); };
  const handleTabKey = (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); selectView(view === 'active' ? 'archived' : 'active'); }
    if (event.key === 'Home') { event.preventDefault(); selectView('active'); }
    if (event.key === 'End') { event.preventDefault(); selectView('archived'); }
  };
  const items = result?.items ?? [];
  const pagination = result?.pagination ?? { page, page_count: 1, total: 0 };
  return <div className="patient-certificates"><header className="certificates-heading"><h1>My Certificates</h1><p>View current certificates or review limited information about expired certificates.</p></header><div className="certificate-tabs" role="tablist" aria-label="Certificate access"><button id="certificate-tab-active" role="tab" aria-selected={view === 'active'} aria-controls="certificate-panel" tabIndex={view === 'active' ? 0 : -1} type="button" onClick={() => selectView('active')} onKeyDown={handleTabKey}>Active</button><button id="certificate-tab-archived" role="tab" aria-selected={view === 'archived'} aria-controls="certificate-panel" tabIndex={view === 'archived' ? 0 : -1} type="button" onClick={() => selectView('archived')} onKeyDown={handleTabKey}>Archived</button></div><div className="certificates-layout"><section id="certificate-panel" role="tabpanel" aria-labelledby={`certificate-tab-${view}`}><p className="certificate-count">{pagination.total} {view} {pagination.total === 1 ? 'certificate' : 'certificates'} · Most recent first</p>{status === 'loading' && <div className="certificate-card" aria-live="polite"><h2>Loading certificates…</h2></div>}{status === 'error' && <div className="certificate-card" role="alert"><h2>Unable to load certificates</h2><p>{error}</p><button type="button" className="action-link" onClick={load}>Retry</button></div>}{status === 'ready' && <><div className="certificate-list">{items.map(item => <article className={`certificate-card certificate-list-item${view === 'archived' ? ' certificate-list-item-archived' : ''}`} key={item.id}><DateTile value={item.date_issued + 'T00:00:00+08:00'} /><div className="certificate-list-copy"><h2>{item.purpose}</h2><StatusBadge status={item.validity_status ?? item.status} /><p><strong>{item.doctor}</strong>{item.specialty && <><br />{item.specialty}</>}</p><p>Certificate no. {item.medical_certificate_number}<br />Issued {formatCertificateDate(item.date_issued)}<br />{item.valid_until ? `Valid until: ${formatCertificateDate(item.valid_until)}` : 'Legacy — No validity date recorded'}</p></div>{view === 'active' && <div className="certificate-list-actions"><Link className="action-link" to={'/patient/certificates/' + item.id}>View Certificate →</Link><CertificatePdfButton certificate={item} /></div>}{view === 'archived' && <p className="certificate-archive-note">Expired certificates are archived. Full details and PDF access are unavailable.</p>}</article>)}</div>{pagination.page_count > 1 && <nav className="certificate-pagination" aria-label={`${view === 'active' ? 'Active' : 'Archived'} medical certificate pages`}><button type="button" className="action-link" disabled={pagination.page === 1} onClick={() => setPages(value => ({ ...value, [view]: Math.max(1, value[view] - 1) }))}>Previous</button><span>Page {pagination.page} of {pagination.page_count}</span><button type="button" className="action-link" disabled={pagination.page === pagination.page_count} onClick={() => setPages(value => ({ ...value, [view]: Math.min(pagination.page_count, value[view] + 1) }))}>Next</button></nav>}{!items.length && <div className="certificate-card"><h2>{view === 'active' ? 'No active certificates' : 'No archived certificates'}</h2><p>{view === 'active' ? 'Current and legacy certificates issued by your doctor will appear here.' : 'Expired certificate metadata will appear here.'}</p></div>}</>}</section><aside className="certificate-card"><h2>About Certificate Access</h2><p>Active and legacy certificates remain available to view and download.</p><p>Expired certificates show metadata only and cannot be opened or downloaded by Patients.</p></aside></div></div>;
}

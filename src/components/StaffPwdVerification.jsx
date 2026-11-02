import { useEffect, useState } from 'react';
import { staffApiErrorMessage, staffApiService } from '../services/staffApiService.js';

const emptyPage = Object.freeze({ items: [], page: 1, page_count: 1, total: 0 });

export default function StaffPwdVerification() {
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [list, setList] = useState({ loading: true, error: '', result: emptyPage });
  const [review, setReview] = useState({ loading: false, error: '', item: null, documentUrl: '', contentType: '' });
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setList(current => ({ ...current, loading: true, error: '' }));
    staffApiService.getPwdVerifications(page)
      .then(result => active && setList({ loading: false, error: '', result }))
      .catch(error => active && setList({ loading: false, error: staffApiErrorMessage(error, 'Unable to load PWD verification requests.'), result: emptyPage }));
    return () => { active = false; };
  }, [page, version]);

  useEffect(() => () => {
    if (review.documentUrl) URL.revokeObjectURL(review.documentUrl);
  }, [review.documentUrl]);

  async function openReview(id) {
    setMessage(''); setActionError(''); setReason('');
    setReview({ loading: true, error: '', item: null, documentUrl: '', contentType: '' });
    try {
      const [item, document] = await Promise.all([
        staffApiService.getPwdVerification(id),
        staffApiService.getPwdVerificationDocument(id),
      ]);
      setReview({ loading: false, error: '', item, documentUrl: URL.createObjectURL(document.blob), contentType: document.contentType });
    } catch (error) {
      setReview({ loading: false, error: staffApiErrorMessage(error, 'Unable to open this PWD verification request.'), item: null, documentUrl: '', contentType: '' });
    }
  }

  function closeReview() {
    setReview({ loading: false, error: '', item: null, documentUrl: '', contentType: '' });
    setReason(''); setActionError('');
  }

  async function complete(action) {
    if (!review.item || submitting) return;
    if (action === 'reject' && !reason.trim()) { setActionError('Enter a rejection reason.'); return; }
    setSubmitting(true); setActionError(''); setMessage('');
    try {
      if (action === 'verify') await staffApiService.verifyPwdVerification(review.item.id);
      else await staffApiService.rejectPwdVerification(review.item.id, reason);
      closeReview();
      setMessage(action === 'verify' ? 'PWD status verified. The Patient has been notified.' : 'PWD verification rejected. The Patient has been notified.');
      setPage(1);
      setVersion(value => value + 1);
    } catch (error) {
      setActionError(staffApiErrorMessage(error, 'Unable to review this PWD verification request.'));
    } finally { setSubmitting(false); }
  }

  const result = list.result;
  return <section className="patients-panel pwd-review-panel" aria-labelledby="pwd-requests-heading">
    <div className="pwd-review-heading"><div><h2 id="pwd-requests-heading">PWD Verification Requests</h2><p>Pending requests are shown oldest first.</p></div><span>{result.total} pending</span></div>
    {message && <p className="pwd-review-success" role="status">{message}</p>}
    {list.loading ? <p role="status">Loading PWD verification requests…</p> : list.error ? <p role="alert">{list.error}</p> : result.items.length ? <ul className="pwd-request-list">{result.items.map(item => <li key={item.id}><div><strong>{item.patientName}</strong><p>Submitted <time dateTime={item.submitted_at}>{new Date(item.submitted_at).toLocaleString()}</time></p><span className="pwd-request-status">Pending Verification</span></div><button type="button" onClick={() => openReview(item.id)}>Review</button></li>)}</ul> : <div className="patients-empty"><h3>No pending PWD verification requests.</h3><p>New Patient submissions will appear here.</p></div>}
    {!list.loading && !list.error && result.page_count > 1 && <nav className="patients-pagination" aria-label="PWD verification request pages"><button type="button" disabled={page === 1} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page} of {result.page_count}</span><button type="button" disabled={page === result.page_count} onClick={() => setPage(value => value + 1)}>Next</button></nav>}
    {(review.loading || review.error || review.item) && <section className="pwd-review-detail" aria-labelledby="pwd-review-detail-heading">
      {review.loading ? <p role="status">Opening private verification document…</p> : review.error ? <><p role="alert">{review.error}</p><button type="button" onClick={closeReview}>Close</button></> : <>
        <div className="pwd-review-detail-heading"><div><h3 id="pwd-review-detail-heading">Review {review.item.patient_name}</h3><p>Submitted {new Date(review.item.submitted_at).toLocaleString()}</p></div><button type="button" onClick={closeReview}>Close</button></div>
        <dl><div><dt>PWD ID number</dt><dd>{review.item.pwd_id_number}</dd></div><div><dt>Status</dt><dd>Pending Verification</dd></div></dl>
        <div className="pwd-private-document">{review.contentType === 'application/pdf' ? <iframe title={`${review.item.patient_name} PWD verification document`} src={review.documentUrl} /> : <img src={review.documentUrl} alt={`${review.item.patient_name} PWD verification document`} />}</div>
        <p className="pwd-private-note">Private clinic document. Do not copy or share Patient identity information.</p>
        {actionError && <p className="pwd-review-error" role="alert">{actionError}</p>}
        <label htmlFor="pwd-rejection-reason">Rejection reason<textarea id="pwd-rejection-reason" maxLength={500} rows={3} value={reason} onChange={event => { setReason(event.target.value); setActionError(''); }} placeholder="Required only when rejecting" /></label>
        <div className="pwd-review-actions"><button type="button" disabled={submitting} onClick={() => complete('verify')}>{submitting ? 'Saving…' : 'Verify PWD'}</button><button type="button" className="pwd-reject-action" disabled={submitting} onClick={() => complete('reject')}>Reject</button></div>
      </>}
    </section>}
  </section>;
}

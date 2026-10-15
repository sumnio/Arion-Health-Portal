import { useEffect, useRef, useState } from 'react';
import RecordSection from '../records/RecordSection.jsx';
import { doctorApiService } from '../../services/doctorApiService.js';
import '../../styles/certificate-pdf-preview.css';

const PREVIEW_DEBOUNCE_MS = 600;

function ready(values) {
  return Boolean(
    values.purpose
    && (values.purpose !== 'Other' || values.custom_purpose.trim())
    && values.diagnosis_summary.trim()
    && values.recommendation.trim(),
  );
}

export default function CertificatePdfPreview({ recordId, values = {}, certificateId = null, service = doctorApiService, bare = false }) {
  const [state, setState] = useState(certificateId ? 'updating' : 'incomplete');
  const [previewUrl, setPreviewUrl] = useState('');
  const urlRef = useRef('');
  const requestRef = useRef(0);

  function replaceUrl(nextUrl) {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = nextUrl;
    setPreviewUrl(nextUrl);
  }

  useEffect(() => () => {
    requestRef.current += 1;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  useEffect(() => {
    const requestId = ++requestRef.current;
    const controller = new AbortController();
    let timer;

    if (!certificateId && !ready(values)) {
      replaceUrl('');
      setState('incomplete');
      return () => controller.abort();
    }

    setState('updating');
    timer = setTimeout(async () => {
      try {
        const result = certificateId
          ? await service.downloadCertificatePdf(certificateId, { signal: controller.signal })
          : await service.previewCertificatePdf(recordId, values, { signal: controller.signal });
        if (requestId !== requestRef.current || controller.signal.aborted) return;
        replaceUrl(URL.createObjectURL(result.blob ?? result));
        setState('ready');
      } catch {
        if (requestId !== requestRef.current || controller.signal.aborted) return;
        replaceUrl('');
        setState('error');
      }
    }, certificateId ? 0 : PREVIEW_DEBOUNCE_MS);

    return () => { clearTimeout(timer); controller.abort(); };
  }, [certificateId, recordId, service, values.purpose, values.custom_purpose, values.diagnosis_summary, values.recommendation, values.valid_until]);

  const content = <>
    {state === 'incomplete' && <p className="certificate-preview-state">Complete the required certificate fields to generate the PDF preview.</p>}
    {state === 'updating' && <p className="certificate-preview-state" role="status">Updating certificate preview...</p>}
    {state === 'error' && <p className="certificate-error" role="alert">Certificate preview could not be generated.</p>}
    {previewUrl && <iframe className="certificate-pdf-preview" src={previewUrl} title={certificateId ? 'Issued medical certificate PDF' : 'Draft medical certificate PDF preview'} />}
  </>;
  return bare ? content : <RecordSection title={certificateId ? 'Issued Certificate' : 'Certificate Preview'}>{content}</RecordSection>;
}

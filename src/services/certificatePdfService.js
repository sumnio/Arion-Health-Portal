function ascii(value, fallback = 'Not available') {
  const text = String(value ?? '').trim() || fallback;
  return text.normalize('NFKD').replace(/[^\x20-\x7E]/g, '?');
}

export function certificatePdfFilename(certificate) {
  const number = ascii(certificate?.medical_certificate_number, 'certificate').replace(/[^A-Za-z0-9._-]+/g, '-');
  return `Medical-Certificate-${number}.pdf`;
}

export async function downloadCertificatePdf(certificate, fetchPdf, environment = globalThis) {
  if (!certificate?.id || certificate.status !== 'issued') throw new Error('Only an issued medical certificate can be downloaded.');
  const result = await fetchPdf(certificate.id); const blob = result?.blob ?? result;
  const BlobConstructor = environment.Blob ?? Blob;
  const pdfBlob = blob instanceof BlobConstructor ? blob : new BlobConstructor([blob], { type: 'application/pdf' });
  const url = environment.URL.createObjectURL(pdfBlob); const anchor = environment.document.createElement('a');
  anchor.href = url; anchor.download = certificatePdfFilename(certificate); anchor.hidden = true;
  environment.document.body.appendChild(anchor); anchor.click(); anchor.remove();
  environment.setTimeout(() => environment.URL.revokeObjectURL(url), 0);
}

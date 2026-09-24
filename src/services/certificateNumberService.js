const PREFIX = 'MC-MOCK';

// Preview-only numbering. The backend may replace this format while retaining
// the uniqueness requirement.
export function nextMockCertificateNumber(dateIssued, certificates = []) {
  const datePart = /^\d{4}-\d{2}-\d{2}$/.test(dateIssued ?? '') ? dateIssued.replaceAll('-', '') : 'UNDATED';
  const stem = `${PREFIX}-${datePart}-`;
  const used = new Set(certificates.map(item => item.medical_certificate_number).filter(Boolean));
  let sequence = 1;
  let candidate;
  do {
    candidate = stem + String(sequence).padStart(3, '0');
    sequence += 1;
  } while (used.has(candidate));
  return candidate;
}

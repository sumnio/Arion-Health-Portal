export function resolveCertificateIssuanceEnabled(value) {
  return value == null || value === '' ? true : String(value).trim().toLowerCase() === 'true';
}

export const certificateIssuanceEnabled = resolveCertificateIssuanceEnabled(
  import.meta.env?.VITE_CERTIFICATE_ISSUANCE_ENABLED,
);

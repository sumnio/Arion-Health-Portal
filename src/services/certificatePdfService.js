function ascii(value, fallback = 'Not available') {
  const text = String(value ?? '').trim() || fallback;
  return text.normalize('NFKD').replace(/[^\x20-\x7E]/g, '?');
}

function escapePdf(value) {
  return ascii(value).replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}

function wrap(value, length = 76) {
  const words = ascii(value).split(/\s+/); const lines = []; let line = '';
  for (const word of words) {
    if (!line) line = word;
    else if (`${line} ${word}`.length <= length) line += ` ${word}`;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : ['Not available'];
}

function pdfDate(value) {
  if (!value) return 'Not applicable';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? ascii(value) : new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(date);
}

export function certificatePdfFilename(certificate) {
  const number = ascii(certificate?.medical_certificate_number, 'certificate').replace(/[^A-Za-z0-9._-]+/g, '-');
  return `Medical-Certificate-${number}.pdf`;
}

export function buildCertificatePdf(certificate) {
  if (!certificate || certificate.status !== 'issued') throw new Error('Only an issued medical certificate can be downloaded.');
  const commands = []; let y = 748;
  const line = (text, { size = 11, bold = false, x = 72, gap = 18 } = {}) => {
    commands.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${y} Td (${escapePdf(text)}) Tj ET`); y -= gap;
  };
  const labeled = (label, value) => { line(label, { size: 9, bold: true, gap: 13 }); for (const text of wrap(value)) line(text, { size: 11, gap: 15 }); y -= 5; };
  line(certificate.clinic?.name ?? 'Arion Health Clinic', { size: 18, bold: true, gap: 22 });
  for (const text of wrap(certificate.clinic?.location ?? 'Clinic location unavailable', 86)) line(text, { size: 9, gap: 13 });
  y -= 18; line('MEDICAL CERTIFICATE', { size: 20, bold: true, gap: 26 });
  line(`Certificate No. ${certificate.medical_certificate_number}`, { size: 10, gap: 24 });
  labeled('PATIENT', certificate.patientName);
  labeled('PURPOSE', certificate.purpose);
  labeled('DIAGNOSIS SUMMARY', certificate.diagnosis_summary);
  labeled('DATE ISSUED', pdfDate(certificate.date_issued));
  if (certificate.valid_until) labeled('VALID UNTIL', pdfDate(certificate.valid_until));
  y -= 18; line('ISSUING DOCTOR', { size: 9, bold: true, gap: 16 });
  line(certificate.doctor, { size: 13, bold: true, gap: 17 });
  if (certificate.specialty) line(certificate.specialty, { size: 10, gap: 15 });
  line(`License No. ${certificate.license_number} | PTR No. ${certificate.ptr_number}`, { size: 10, gap: 16 });
  line(certificate.signature_available ? 'Doctor signature on file' : 'Doctor signature unavailable', { size: 9, gap: 24 });
  line('Issued and read-only in Arion Health Portal', { size: 8, gap: 12 });

  const stream = commands.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  const encoder = new TextEncoder(); let output = '%PDF-1.4\n% Arion Health Portal\n'; const offsets = [0];
  objects.forEach((body, index) => { offsets.push(encoder.encode(output).length); output += `${index + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = encoder.encode(output).length;
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  output += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return encoder.encode(output);
}

export function downloadCertificatePdf(certificate, environment = globalThis) {
  const bytes = buildCertificatePdf(certificate);
  const BlobConstructor = environment.Blob ?? Blob;
  const blob = new BlobConstructor([bytes], { type: 'application/pdf' });
  const url = environment.URL.createObjectURL(blob); const anchor = environment.document.createElement('a');
  anchor.href = url; anchor.download = certificatePdfFilename(certificate); anchor.hidden = true;
  environment.document.body.appendChild(anchor); anchor.click(); anchor.remove();
  environment.setTimeout(() => environment.URL.revokeObjectURL(url), 0);
}

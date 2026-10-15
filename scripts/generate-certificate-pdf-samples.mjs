import { mkdir, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { buildCertificatePdf } from '../server/src/services/certificatePdfService.js';

function chunk(type, data = Buffer.alloc(0)) {
  const result = Buffer.alloc(12 + data.length); result.writeUInt32BE(data.length, 0); result.write(type, 4, 4, 'ascii'); data.copy(result, 8); return result;
}
function syntheticSignature(width = 600, height = 180) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 4, 255); row[0] = 0;
    for (let x = 0; x < width; x += 1) {
      const p = 1 + x * 4; const ink = y > 55 && y < 120 && Math.abs(y - (85 + Math.sin(x / 32) * 23)) < 5;
      row[p] = 8; row[p + 1] = 70; row[p + 2] = 140; row[p + 3] = ink ? 255 : 0;
    }
    rows.push(row);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(rows))), chunk('IEND')]);
}

const base = {
  medical_certificate_number: 'AHC-MC-2026-1015', date_issued: '2026-10-15', consultation_date: '2026-10-13', valid_until: '2026-10-18',
  patient_name: 'Synthetic Patient', patient_dob: '1995-02-01', patient_sex: 'male', purpose: 'Sick Leave',
  statement: 'This is to certify that the above-named patient was examined and consulted at Arion Health Clinic on the date indicated. Based on the clinical evaluation, the patient is presently unfit for regular duties due to a medical condition.',
  diagnosis_summary: 'Acute upper respiratory tract infection.',
  recommendation: 'The patient is advised to rest for two days, maintain adequate hydration, and return for follow-up if symptoms persist or worsen.',
  doctor_name: 'Dr. Maria Synthetic Santos', doctor_specialty: 'General Medicine', license_number: 'PRC-TEST-0123456', ptr_number: 'PTR-TEST-9876543',
  clinic: { name: 'Arion Health Clinic', location: '123 Wellness Street, Quezon City, Metro Manila', contact_number: '(02) 8123 4567', email: 'info@example.test' },
};
const long = 'This is synthetic content used only to verify wrapping, spacing, page continuation, and footer safety in the generated medical certificate. '.repeat(4).slice(0, 500);
const samples = [
  ['A-sick-leave', base],
  ['B-school-absence', { ...base, medical_certificate_number: 'AHC-MC-2026-1016', purpose: 'School Absence', statement: 'This is to certify that the above-named patient was examined at Arion Health Clinic and may be excused from school as stated in the recommendation below.' }],
  ['C-fit-to-return', { ...base, medical_certificate_number: 'AHC-MC-2026-1017', purpose: 'Fit to Return', statement: 'This is to certify that the above-named patient was evaluated at Arion Health Clinic and may return to regular duties as stated in the recommendation below.', recommendation: 'Fit to return to regular duties on October 18, 2026.' }],
  ['D-other', { ...base, medical_certificate_number: 'AHC-MC-2026-1018', purpose: 'Insurance documentation for an employer medical-leave review' }],
  ['E-long-names', { ...base, medical_certificate_number: 'AHC-MC-2026-1019', patient_name: 'Alexandria Bernadette Maximiliana Synthetic Patient-Santos the Third', doctor_name: 'Dr. Maximiliano Alessandro Synthetic Physician-De la Cruz' }],
  ['F-long-recommendation', { ...base, medical_certificate_number: 'AHC-MC-2026-1020', recommendation: long }],
  ['G-multipage-content', { ...base, medical_certificate_number: 'AHC-MC-2026-1021', purpose: long, diagnosis_summary: long, recommendation: long }],
];
await mkdir('tmp/pdfs', { recursive: true }); await mkdir('output/pdf', { recursive: true });
const signatureBuffer = syntheticSignature();
for (const [name, data] of samples) {
  await writeFile(`tmp/pdfs/${name}-final.pdf`, buildCertificatePdf(data, { signatureBuffer }));
  await writeFile(`tmp/pdfs/${name}-draft.pdf`, buildCertificatePdf({ ...data, medical_certificate_number: 'DRAFT PREVIEW' }, { signatureBuffer }));
}
await writeFile('output/pdf/Arion-Medical-Certificate-Synthetic-Sample.pdf', buildCertificatePdf(base, { signatureBuffer }));

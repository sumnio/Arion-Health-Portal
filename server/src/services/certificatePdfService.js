import { readFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';

export const CERTIFICATE_PDF_RENDER_VERSION = 'arion-certificate-v2';
const PAGE = Object.freeze({ width: 595.28, height: 841.89, margin: 48 });
const BLUE = '0.04 0.29 0.55';
const MID_BLUE = '0.23 0.56 0.82';
const LIGHT_BLUE = '0.91 0.96 0.99';
const TEXT = '0.06 0.15 0.27';
const MUTED = '0.30 0.39 0.49';

function plain(value, fallback = 'Not available') {
  return (String(value ?? '').trim() || fallback).normalize('NFKD').replace(/[^\x20-\x7E]/g, '?');
}
function escapePdf(value) { return plain(value).replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)'); }
function approximateWidth(text, size, bold = false) { return plain(text).length * size * (bold ? 0.56 : 0.51); }
function wrap(value, width, size, bold = false) {
  const words = plain(value).split(/\s+/); const lines = []; let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || approximateWidth(candidate, size, bold) <= width) line = candidate;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : ['Not available'];
}
function formatDate(value) {
  if (!value) return 'Not applicable';
  const parsed = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? plain(value) : new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(parsed);
}
function ageAt(dob, at) {
  if (!dob || !at) return null;
  const birth = String(dob).slice(0, 10); const date = String(at).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return Number(date.slice(0, 4)) - Number(birth.slice(0, 4)) - (date.slice(5) < birth.slice(5) ? 1 : 0);
}
function sexLabel(value) { return ({ male: 'Male', female: 'Female', other: 'Other', prefer_not_to_say: 'Prefer not to say' })[value] ?? plain(value); }

function paeth(a, b, c) {
  const p = a + b - c; const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}
function decodePng(buffer, label = 'Signature PNG') {
  if (!Buffer.isBuffer(buffer) || !buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error(`${label} is invalid.`);
  let offset = 8; let width; let height; let bitDepth; let colorType; let interlace; const idat = [];
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset); const type = buffer.subarray(offset + 4, offset + 8).toString('ascii'); const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; interlace = data[12]; }
    if (type === 'IDAT') idat.push(data);
    offset += 12 + length;
    if (type === 'IEND') break;
  }
  const channels = ({ 0: 1, 2: 3, 6: 4 })[colorType];
  if (!width || !height || bitDepth !== 8 || !channels || interlace !== 0 || !idat.length) throw new Error(`${label} uses an unsupported format.`);
  const compressed = Buffer.concat(idat); const raw = inflateSync(compressed); const stride = width * channels; const decoded = Buffer.alloc(stride * height);
  let source = 0;
  for (let row = 0; row < height; row += 1) {
    const filter = raw[source++]; const rowStart = row * stride;
    for (let column = 0; column < stride; column += 1) {
      const x = raw[source++]; const left = column >= channels ? decoded[rowStart + column - channels] : 0;
      const up = row ? decoded[rowStart - stride + column] : 0;
      const upperLeft = row && column >= channels ? decoded[rowStart - stride + column - channels] : 0;
      const value = filter === 0 ? x : filter === 1 ? x + left : filter === 2 ? x + up : filter === 3 ? x + Math.floor((left + up) / 2) : filter === 4 ? x + paeth(left, up, upperLeft) : NaN;
      if (!Number.isFinite(value)) throw new Error(`${label} filter is unsupported.`);
      decoded[rowStart + column] = value & 255;
    }
  }
  const rgb = Buffer.alloc(width * height * 3); const alpha = colorType === 6 ? Buffer.alloc(width * height) : null;
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    if (colorType === 0) rgb.fill(decoded[pixel], pixel * 3, pixel * 3 + 3);
    else { rgb[pixel * 3] = decoded[pixel * channels]; rgb[pixel * 3 + 1] = decoded[pixel * channels + 1]; rgb[pixel * 3 + 2] = decoded[pixel * channels + 2]; }
    if (alpha) alpha[pixel] = decoded[pixel * channels + 3];
  }
  return { width, height, rgb: deflateSync(rgb), alpha: alpha ? deflateSync(alpha) : null };
}

const logoBuffer = readFileSync(new URL('../assets/arion-medical-logo.png', import.meta.url));
const ARION_LOGO = Object.freeze(decodePng(logoBuffer, 'Arion logo PNG'));

class PdfDocument {
  constructor(signature, signatureMissingText) { this.pages = []; this.signature = signature ? decodePng(signature) : null; this.signatureMissingText = signatureMissingText; this.logo = ARION_LOGO; this.newPage(); }
  newPage() { this.page = []; this.pages.push(this.page); this.y = PAGE.height - PAGE.margin; }
  command(value) { this.page.push(value); }
  text(value, x, y, { size = 10, bold = false, color = TEXT } = {}) { this.command(`BT ${color} rg /${bold ? 'F2' : 'F1'} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdf(value)}) Tj ET`); }
  centered(value, y, options = {}) { const size = options.size ?? 10; const bold = options.bold ?? false; this.text(value, (PAGE.width - approximateWidth(value, size, bold)) / 2, y, options); }
  line(x1, y1, x2, y2, width = 1, color = BLUE) { this.command(`${color} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S`); }
  fill(x, y, width, height, color) { this.command(`${color} rg ${x} ${y} ${width} ${height} re f`); }
  polygon(points, color) { this.command(`${color} rg ${points.map(([x, y], index) => `${x} ${y} ${index ? 'l' : 'm'}`).join(' ')} h f`); }
  ensure(height) { if (this.y - height < 70) { this.footer(); this.newPage(); this.continuationHeader(); } }
  paragraph(value, { x = PAGE.margin, width = PAGE.width - PAGE.margin * 2, size = 10.5, leading = 15, color = TEXT } = {}) {
    const lines = wrap(value, width, size); this.ensure(lines.length * leading + 8);
    for (const line of lines) { this.text(line, x, this.y, { size, color }); this.y -= leading; }
    this.y -= 5;
  }
  section(label, value) {
    const remaining = wrap(value, PAGE.width - 215, 10.5); let continued = false;
    while (remaining.length) {
      this.ensure(60);
      const maximumLines = Math.max(1, Math.floor((this.y - 82 - 18) / 15));
      const lines = remaining.splice(0, maximumLines); const height = Math.max(38, lines.length * 15 + 18);
      this.fill(PAGE.margin, this.y - height + 9, 145, height, LIGHT_BLUE);
      this.text(label.toUpperCase(), PAGE.margin + 14, this.y - 12, { size: 9.5, bold: true, color: BLUE });
      if (continued) this.text('CONTINUED', PAGE.margin + 14, this.y - 25, { size: 7.5, bold: true, color: MUTED });
      let lineY = this.y - 12; for (const line of lines) { this.text(line, PAGE.margin + 165, lineY, { size: 10.5 }); lineY -= 15; }
      this.line(PAGE.margin, this.y - height + 9, PAGE.width - PAGE.margin, this.y - height + 9, 0.5, '0.72 0.84 0.94'); this.y -= height + 8;
      if (remaining.length) { this.footer(); this.newPage(); this.continuationHeader(); continued = true; }
    }
  }
  header(clinic) {
    const top = PAGE.height - 45;
    this.polygon([[0, PAGE.height], [178, PAGE.height], [0, PAGE.height - 92]], LIGHT_BLUE);
    this.polygon([[0, PAGE.height], [112, PAGE.height], [0, PAGE.height - 57]], MID_BLUE);
    const logoHeight = 67; const logoWidth = logoHeight * this.logo.width / this.logo.height;
    this.command(`q ${logoWidth.toFixed(2)} 0 0 ${logoHeight.toFixed(2)} ${PAGE.margin.toFixed(2)} ${(top - 55).toFixed(2)} cm /Logo Do Q`);
    this.text(clinic.name ?? 'Arion Health Clinic', 128, top - 10, { size: 21, bold: true, color: BLUE });
    const details = [clinic.location, clinic.contact_number, clinic.email, clinic.website].filter(Boolean).map(plain).join('  |  ');
    for (const [index, line] of wrap(details || 'Clinic contact information not configured', 418, 8.5).entries()) this.text(line, 128, top - 29 - index * 11, { size: 8.5, color: MUTED });
    this.line(PAGE.margin, top - 67, PAGE.width - PAGE.margin, top - 67, 1.4); this.y = top - 96;
  }
  continuationHeader() { this.text('ARION HEALTH CLINIC - MEDICAL CERTIFICATE', PAGE.margin, PAGE.height - 48, { size: 9, bold: true, color: BLUE }); this.line(PAGE.margin, PAGE.height - 57, PAGE.width - PAGE.margin, PAGE.height - 57, 0.7); this.y = PAGE.height - 82; }
  footer() { this.polygon([[PAGE.width, 0], [PAGE.width - 92, 0], [PAGE.width, 58]], LIGHT_BLUE); this.polygon([[PAGE.width, 0], [PAGE.width - 52, 0], [PAGE.width, 34]], MID_BLUE); this.line(PAGE.margin, 52, PAGE.width - PAGE.margin, 52, 0.6, '0.65 0.75 0.84'); this.text('Issued electronically through Arion Health Portal.', PAGE.margin, 36, { size: 7.5, color: MUTED }); this.text(`Page ${this.pages.length}`, PAGE.width - 82, 36, { size: 7.5, color: MUTED }); }
  signatureBlock(certificate) {
    this.ensure(145); const start = this.y;
    if (this.signature) {
      const maxWidth = 155; const maxHeight = 54; const scale = Math.min(maxWidth / this.signature.width, maxHeight / this.signature.height);
      const width = this.signature.width * scale; const height = this.signature.height * scale;
      this.command(`q ${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${(PAGE.width - PAGE.margin - width).toFixed(2)} ${(start - height + 6).toFixed(2)} cm /Sig Do Q`);
    } else this.text(this.signatureMissingText, PAGE.width - 275, start - 18, { size: 8.5, color: MUTED });
    const x = PAGE.width - 275; this.line(x, start - 58, PAGE.width - PAGE.margin, start - 58, 0.7, BLUE);
    const doctorLines = wrap(certificate.doctor_name, PAGE.width - PAGE.margin - x, 10.5, true).slice(0, 3); let doctorY = start - 74;
    for (const line of doctorLines) { this.text(line, x, doctorY, { size: 10.5, bold: true }); doctorY -= 14; }
    this.text(certificate.doctor_specialty, x, doctorY - 2, { size: 9, color: MUTED });
    this.text(`PRC License No. ${certificate.license_number}`, x, doctorY - 16, { size: 8.5, color: MUTED });
    this.text(`PTR No. ${certificate.ptr_number}`, x, doctorY - 29, { size: 8.5, color: MUTED }); this.y -= 150;
  }
  serialize() {
    this.footer(); const objects = [];
    const add = body => { objects.push(body); return objects.length; };
    const catalog = add(''); const pagesRoot = add('');
    const fontNormal = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const fontBold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    let logoSmask = null;
    if (this.logo.alpha) logoSmask = add(Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${this.logo.width} /Height ${this.logo.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${this.logo.alpha.length} >>\nstream\n`), this.logo.alpha, Buffer.from('\nendstream')]));
    const logo = add(Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${this.logo.width} /Height ${this.logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode${logoSmask ? ` /SMask ${logoSmask} 0 R` : ''} /Length ${this.logo.rgb.length} >>\nstream\n`), this.logo.rgb, Buffer.from('\nendstream')]));
    let smask = null; let image = null;
    if (this.signature) {
      if (this.signature.alpha) smask = add(Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${this.signature.width} /Height ${this.signature.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${this.signature.alpha.length} >>\nstream\n`), this.signature.alpha, Buffer.from('\nendstream')]));
      image = add(Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${this.signature.width} /Height ${this.signature.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode${smask ? ` /SMask ${smask} 0 R` : ''} /Length ${this.signature.rgb.length} >>\nstream\n`), this.signature.rgb, Buffer.from('\nendstream')]));
    }
    const pageIds = [];
    for (const commands of this.pages) {
      const stream = Buffer.from(commands.join('\n'), 'binary'); const content = add(Buffer.concat([Buffer.from(`<< /Length ${stream.length} >>\nstream\n`), stream, Buffer.from('\nendstream')]));
      const resources = `<< /Font << /F1 ${fontNormal} 0 R /F2 ${fontBold} 0 R >> /XObject << /Logo ${logo} 0 R${image ? ` /Sig ${image} 0 R` : ''} >> >>`;
      pageIds.push(add(`<< /Type /Page /Parent ${pagesRoot} 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] /Resources ${resources} /Contents ${content} 0 R >>`));
    }
    objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesRoot} 0 R >>`;
    objects[pagesRoot - 1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
    const chunks = [Buffer.from('%PDF-1.4\n% Arion Health Portal\n')]; const offsets = [0]; let length = chunks[0].length;
    objects.forEach((body, index) => { offsets.push(length); const chunk = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`), Buffer.isBuffer(body) ? body : Buffer.from(body, 'binary'), Buffer.from('\nendobj\n')]); chunks.push(chunk); length += chunk.length; });
    const xref = length; let trailer = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    trailer += offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
    trailer += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.concat([...chunks, Buffer.from(trailer)]);
  }
}

export function buildCertificatePdf(certificate, { signatureBuffer = null, signatureMissingText = 'Legacy certificate - signature not archived' } = {}) {
  const document = new PdfDocument(signatureBuffer, signatureMissingText); document.header(certificate.clinic ?? {});
  document.centered('MEDICAL CERTIFICATE', document.y, { size: 22, bold: true, color: BLUE }); document.y -= 17;
  document.line(205, document.y, 390, document.y, 0.8, MID_BLUE); document.y -= 16;
  document.centered(`Certificate No. ${plain(certificate.medical_certificate_number)}  |  Date Issued: ${formatDate(certificate.date_issued)}`, document.y, { size: 9, color: MUTED }); document.y -= 30;
  const patientNameLines = wrap(`Patient Name: ${plain(certificate.patient_name)}`, PAGE.width - PAGE.margin * 2 - 28, 10.5, true);
  const patientInformationHeight = 78 + Math.max(0, patientNameLines.length - 1) * 14;
  document.fill(PAGE.margin, document.y - patientInformationHeight, PAGE.width - PAGE.margin * 2, patientInformationHeight, '0.96 0.98 1');
  document.fill(PAGE.margin, document.y - 27, PAGE.width - PAGE.margin * 2, 27, LIGHT_BLUE);
  document.text('PATIENT INFORMATION', PAGE.margin + 14, document.y - 18, { size: 10, bold: true, color: BLUE });
  const age = ageAt(certificate.patient_dob, certificate.consultation_date ?? certificate.date_issued);
  let patientLineY = document.y - 39;
  for (const line of patientNameLines) { document.text(line, PAGE.margin + 14, patientLineY, { size: 10.5, bold: true }); patientLineY -= 14; }
  document.text(`Age / Sex: ${age == null ? 'Not available' : `${age} years old`} / ${sexLabel(certificate.patient_sex)}`, PAGE.margin + 14, patientLineY - 5, { size: 9.5 });
  document.text(`Consultation Date: ${formatDate(certificate.consultation_date)}`, PAGE.margin + 14, patientLineY - 24, { size: 9.5 }); document.y -= patientInformationHeight + 23;
  document.paragraph(certificate.statement, { size: 10.5, leading: 16 });
  document.section('Purpose', certificate.purpose);
  document.section('Diagnosis Summary', certificate.diagnosis_summary);
  document.section('Recommendation', certificate.recommendation ?? 'No additional recommendation recorded.');
  if (certificate.valid_until) document.section('Valid Until', formatDate(certificate.valid_until));
  document.signatureBlock(certificate);
  return document.serialize();
}

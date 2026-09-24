import { medicalCertificates } from '../mocks/certificateData.js';
import { createMockId } from './mockId.js';

const certificates = [...medicalCertificates];
export const medicalCertificateRepository = {
  list() { return certificates; },
  get(id) { return certificates.find(item=>item.id===id) ?? null; },
  create(values) { const certificate={ id:createMockId(), ...values }; certificates.push(certificate); return certificate; },
};

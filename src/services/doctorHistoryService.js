import { doctorPatientService } from './doctorPatientService.js';
import { doctorPrescriptionStore } from '../mocks/doctorRecordStore.js';
import { certificateService } from './certificateService.js';
import { appointmentStore } from '../mocks/appointmentStore.js';

export const doctorHistoryService = {
  get(patientId, selection) {
    const detail = doctorPatientService.get(patientId, selection);
    if (!detail) return null;
    const records = detail.consultationRecords.map(record => ({ ...record,
      prescriptions: record.prescriptions ?? doctorPrescriptionStore.filter(item => item.medical_record_id === record.id),
      appointment: [...detail.patientAppointments, ...appointmentStore].find(item => item.id === record.appointment_id && item.patient_id === patientId) ?? null,
    }));
    const ids = new Set(records.map(item => item.id));
    const certificates = certificateService.listForPatient(patientId, detail.patient.name)
      .filter(item => ids.has(item.medical_record_id) && item.status === 'issued')
      .sort((a,b) => b.date_issued.localeCompare(a.date_issued));
    return structuredClone({ records, certificates });
  },
};

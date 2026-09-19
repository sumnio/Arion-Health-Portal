import { doctorPatientService } from './doctorPatientService.js';
import { doctorPrescriptionStore, demoDoctor } from '../mocks/doctorRecordStore.js';
import { doctorCertificateStore } from '../mocks/doctorCertificateStore.js';
import { certificateService } from './certificateService.js';
import { certificateClinic } from '../mocks/certificateData.js';
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
    const certificates = [...certificateService.list(), ...doctorCertificateStore.map(item => ({ ...item,
      doctor: item.doctor_id === demoDoctor.id ? demoDoctor.display_name : 'Doctor unavailable',
      patientName: detail.patient.name, clinic: certificateClinic,
    }))].filter(item => item.patient_id === patientId && ids.has(item.medical_record_id) && item.status === 'issued')
      .sort((a,b) => b.date_issued.localeCompare(a.date_issued));
    return structuredClone({ records, certificates });
  },
};

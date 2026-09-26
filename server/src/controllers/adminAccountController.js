import { validateEmptyBody } from '../validation/inputValidation.js';
import { requestSecurityEvent } from '../services/securityLogger.js';

function logAdminEvent(request, event, targetType, targetId) {
  requestSecurityEvent(request, {
    event, severity: 'info', outcome: 'success', target_type: targetType, target_id: targetId,
  });
}

export function createAdminAccountController({ adminAccountService: service }) {
  return {
    async createDoctor(request, response) { const doctor = await service.createDoctor(request.body); logAdminEvent(request, 'ADMIN_DOCTOR_CREATED', 'doctor', doctor.id); response.status(201).json({ doctor }); },
    async doctors(request, response) { response.json({ doctors: await service.listDoctors(request.query) }); },
    async doctor(request, response) { response.json({ doctor: await service.getDoctor(request.params.doctorId) }); },
    async updateDoctor(request, response) { response.json({ doctor: await service.updateDoctor(request.params.doctorId, request.body) }); },
    async deactivateDoctor(request, response) { validateEmptyBody(request.body); const doctor = await service.deactivateDoctor(request.params.doctorId); logAdminEvent(request, 'ACCOUNT_DEACTIVATED', 'doctor', doctor.id); response.json({ doctor }); },
    async reactivateDoctor(request, response) { validateEmptyBody(request.body); const doctor = await service.reactivateDoctor(request.params.doctorId); logAdminEvent(request, 'ACCOUNT_REACTIVATED', 'doctor', doctor.id); response.json({ doctor }); },
    async createStaff(request, response) { const staff = await service.createStaff(request.body); logAdminEvent(request, 'ADMIN_STAFF_CREATED', 'staff', staff.id); response.status(201).json({ staff }); },
    async staffList(request, response) { response.json({ staff: await service.listStaff(request.query) }); },
    async staffDetail(request, response) { response.json({ staff: await service.getStaff(request.params.staffId) }); },
    async updateStaff(request, response) { response.json({ staff: await service.updateStaff(request.params.staffId, request.body) }); },
    async deactivateStaff(request, response) { validateEmptyBody(request.body); const staff = await service.deactivateStaff(request.params.staffId); logAdminEvent(request, 'ACCOUNT_DEACTIVATED', 'staff', staff.id); response.json({ staff }); },
    async reactivateStaff(request, response) { validateEmptyBody(request.body); const staff = await service.reactivateStaff(request.params.staffId); logAdminEvent(request, 'ACCOUNT_REACTIVATED', 'staff', staff.id); response.json({ staff }); },
    async patients(request, response) { response.json({ patients: await service.listPatients(request.query) }); },
    async patient(request, response) { response.json({ patient: await service.getPatient(request.params.patientId) }); },
    async deactivatePatient(request, response) { validateEmptyBody(request.body); const patient = await service.deactivatePatient(request.params.patientId); logAdminEvent(request, 'ACCOUNT_DEACTIVATED', 'patient', patient.id); response.json({ patient }); },
    async reactivatePatient(request, response) { validateEmptyBody(request.body); const patient = await service.reactivatePatient(request.params.patientId); logAdminEvent(request, 'ACCOUNT_REACTIVATED', 'patient', patient.id); response.json({ patient }); },
  };
}

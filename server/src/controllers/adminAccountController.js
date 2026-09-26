import { validateEmptyBody } from '../validation/inputValidation.js';

export function createAdminAccountController({ adminAccountService: service }) {
  return {
    async createDoctor(request, response) { response.status(201).json({ doctor: await service.createDoctor(request.body) }); },
    async doctors(request, response) { response.json({ doctors: await service.listDoctors(request.query) }); },
    async doctor(request, response) { response.json({ doctor: await service.getDoctor(request.params.doctorId) }); },
    async updateDoctor(request, response) { response.json({ doctor: await service.updateDoctor(request.params.doctorId, request.body) }); },
    async deactivateDoctor(request, response) { validateEmptyBody(request.body); response.json({ doctor: await service.deactivateDoctor(request.params.doctorId) }); },
    async reactivateDoctor(request, response) { validateEmptyBody(request.body); response.json({ doctor: await service.reactivateDoctor(request.params.doctorId) }); },
    async createStaff(request, response) { response.status(201).json({ staff: await service.createStaff(request.body) }); },
    async staffList(request, response) { response.json({ staff: await service.listStaff(request.query) }); },
    async staffDetail(request, response) { response.json({ staff: await service.getStaff(request.params.staffId) }); },
    async updateStaff(request, response) { response.json({ staff: await service.updateStaff(request.params.staffId, request.body) }); },
    async deactivateStaff(request, response) { validateEmptyBody(request.body); response.json({ staff: await service.deactivateStaff(request.params.staffId) }); },
    async reactivateStaff(request, response) { validateEmptyBody(request.body); response.json({ staff: await service.reactivateStaff(request.params.staffId) }); },
    async patients(request, response) { response.json({ patients: await service.listPatients(request.query) }); },
    async patient(request, response) { response.json({ patient: await service.getPatient(request.params.patientId) }); },
    async deactivatePatient(request, response) { validateEmptyBody(request.body); response.json({ patient: await service.deactivatePatient(request.params.patientId) }); },
    async reactivatePatient(request, response) { validateEmptyBody(request.body); response.json({ patient: await service.reactivatePatient(request.params.patientId) }); },
  };
}

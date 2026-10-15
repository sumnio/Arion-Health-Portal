import { doctorSignatureRepository } from '../repositories/doctorSignatureRepository.js';
import { createGridFsDoctorSignatureStorage } from './doctorSignatureStorage.js';
import { createDoctorSignatureService } from './doctorSignatureService.js';

export function createDoctorSignatureModule({ repository = doctorSignatureRepository, storage = createGridFsDoctorSignatureStorage(), now, logger } = {}) {
  return Object.freeze({ doctorSignatureService: createDoctorSignatureService({ repository, storage, now, logger }) });
}

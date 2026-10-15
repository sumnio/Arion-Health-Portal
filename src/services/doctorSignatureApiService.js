import { doctorApiRepository } from '../repositories/doctorApiRepository.js';

export const DOCTOR_SIGNATURE_MAX_FILE_SIZE = 1024 * 1024;

export function validateDoctorSignatureSelection(file) {
  if (!file) return 'Select a PNG signature image.';
  if (file.type !== 'image/png' || !file.name.toLowerCase().endsWith('.png')) return 'Only PNG signature images are allowed.';
  if (file.size > DOCTOR_SIGNATURE_MAX_FILE_SIZE) return 'The signature image must not exceed 1 MB.';
  return '';
}

export function createDoctorSignatureApiService(repository = doctorApiRepository) {
  return Object.freeze({
    getStatus() { return repository.getSignatureStatus(); },
    async getPreview() {
      const { blob } = await repository.getSignatureImage();
      return blob;
    },
    upload(file) {
      const formData = new FormData();
      formData.append('signature', file);
      return repository.uploadSignature(formData);
    },
  });
}

export const doctorSignatureApiService = createDoctorSignatureApiService();

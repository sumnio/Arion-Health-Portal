import { clinicalRepository } from '../repositories/clinicalRepository.js';
import { createClinicalService } from './clinicalService.js';
import { createGridFsCertificateArtifactStorage } from './certificateArtifactStorage.js';

export function createClinicalModule({ repository = clinicalRepository, clinic, notificationTriggers, smsReminders, doctorSignatureService, certificateArtifactStorage = createGridFsCertificateArtifactStorage(), pdfRenderer, now, numberGenerator, certificateIssuanceEnabled = true } = {}) {
  return { clinicalService: createClinicalService({ repository, clinic, notificationTriggers, smsReminders, doctorSignatureService, certificateArtifactStorage, pdfRenderer, now, numberGenerator, certificateIssuanceEnabled }) };
}

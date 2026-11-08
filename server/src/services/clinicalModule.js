import { clinicalRepository } from '../repositories/clinicalRepository.js';
import { createClinicalService } from './clinicalService.js';
import { createGridFsCertificateArtifactStorage } from './certificateArtifactStorage.js';
import { createGridFsPrescriptionAttachmentStorage } from './prescriptionAttachmentStorage.js';

export function createClinicalModule({ repository = clinicalRepository, clinic, notificationTriggers, smsReminders, doctorSignatureService, certificateArtifactStorage = createGridFsCertificateArtifactStorage(), prescriptionAttachmentStorage = createGridFsPrescriptionAttachmentStorage(), pdfRenderer, now, numberGenerator, certificateIssuanceEnabled = true } = {}) {
  return { clinicalService: createClinicalService({ repository, clinic, notificationTriggers, smsReminders, doctorSignatureService, certificateArtifactStorage, prescriptionAttachmentStorage, pdfRenderer, now, numberGenerator, certificateIssuanceEnabled }) };
}

import { clinicalRepository } from '../repositories/clinicalRepository.js';
import { createClinicalService } from './clinicalService.js';

export function createClinicalModule({ repository = clinicalRepository, clinic, notificationTriggers, smsReminders, now, numberGenerator, certificateIssuanceEnabled = true } = {}) {
  return { clinicalService: createClinicalService({ repository, clinic, notificationTriggers, smsReminders, now, numberGenerator, certificateIssuanceEnabled }) };
}

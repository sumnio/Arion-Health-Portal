import { clinicalRepository } from '../repositories/clinicalRepository.js';
import { createClinicalService } from './clinicalService.js';

export function createClinicalModule({ repository = clinicalRepository, clinic, now, numberGenerator } = {}) {
  return { clinicalService: createClinicalService({ repository, clinic, now, numberGenerator }) };
}

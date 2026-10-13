import { supportingDocumentRepository } from '../repositories/supportingDocumentRepository.js';
import { createGridFsSupportingDocumentStorage } from './supportingDocumentStorage.js';
import { createSupportingDocumentService } from './supportingDocumentService.js';

export function createSupportingDocumentModule({
  repository = supportingDocumentRepository,
  storage = createGridFsSupportingDocumentStorage(),
  now,
} = {}) {
  return Object.freeze({
    supportingDocumentService: createSupportingDocumentService({ repository, storage, now }),
  });
}

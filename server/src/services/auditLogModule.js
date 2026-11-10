import { auditLogRepository } from '../repositories/auditLogRepository.js';
import { createAuditLogService } from './auditLogService.js';

export function createAuditLogModule({ repository = auditLogRepository, logger, now } = {}) {
  return {
    auditLogService: createAuditLogService({ repository, logger, now }),
  };
}

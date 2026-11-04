import { portalInvitationRepository } from '../repositories/portalInvitationRepository.js';
import { createPortalInvitationService } from './portalInvitationService.js';
import { passwordService } from './passwordService.js';

export function createPortalInvitationModule({ repository = portalInvitationRepository, tokens, email, passwords = passwordService, now } = {}) {
  return { portalInvitationService: createPortalInvitationService({ repository, tokens, email, passwords, now }) };
}

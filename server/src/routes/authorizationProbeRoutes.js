import { Router } from 'express';
import { createRequireAuth } from '../middleware/authenticate.js';
import {
  requireActiveUser,
  requireOwnership,
  requirePermission,
  requireRole,
} from '../middleware/authorization.js';
import { PERMISSIONS } from '../services/authorizationPolicy.js';

export function createAuthorizationProbeRouter({ service, tokens }) {
  const router = Router();
  const requireAuth = createRequireAuth({ service, tokens });
  const protectedChain = [requireAuth, requireActiveUser];
  const respond = (request, response) => response.json({ user: request.authUser });

  router.get('/protected', ...protectedChain, respond);
  router.get('/role/patient', ...protectedChain, requireRole('patient'), respond);
  router.get('/role/doctor', ...protectedChain, requireRole('doctor'), respond);
  router.get('/role/staff', ...protectedChain, requireRole('staff'), respond);
  router.get('/role/admin', ...protectedChain, requireRole('admin'), respond);
  router.get(
    '/permission/clinical-record-create',
    ...protectedChain,
    requirePermission(PERMISSIONS.CLINICAL_RECORD_CREATE),
    respond,
  );
  router.get(
    '/permission/consultation-complete',
    ...protectedChain,
    requirePermission(PERMISSIONS.CONSULTATION_COMPLETE),
    respond,
  );
  router.get(
    '/ownership/:ownerId',
    ...protectedChain,
    requireOwnership((request) => request.params.ownerId),
    respond,
  );

  return router;
}

import { mockProfiles, exampleIds } from '../mocks/portalData.js';

// UI imports this provider-independent boundary, never a database SDK.
export const portalService = {
  getPreviewProfile(role) { return { ...mockProfiles[role] }; },
  getExamplePath(path) {
    const entity = path.includes('/patients/') ? 'patient'
      : path.includes('/appointments/') ? 'appointment'
      : path.includes('/records/') ? 'record' : 'certificate';
    return path.replace(':id', exampleIds[entity]);
  },
};


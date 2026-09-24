import { doctorAvailabilityStore, doctorPublishedAvailabilityStore, doctorBlockedTimeStore } from '../mocks/doctorAvailabilityStore.js';

// Separate entity stores share one scheduling repository boundary.
export const doctorAvailabilityRepository = {
  recurring: doctorAvailabilityStore,
  published: doctorPublishedAvailabilityStore,
  blocked: doctorBlockedTimeStore,
};


import { validateEmptyBody } from '../validation/inputValidation.js';

export function createDoctorAvailabilityController({ doctorAvailabilityService }) {
  return {
    async listRecurring(request, response) {
      response.json({ availability: await doctorAvailabilityService.listRecurring(request.authUser.user_profile_id) });
    },
    async createRecurring(request, response) {
      response.status(201).json({ availability: await doctorAvailabilityService.createRecurring(request.authUser.user_profile_id, request.body) });
    },
    async updateRecurring(request, response) {
      response.json({ availability: await doctorAvailabilityService.updateRecurring(request.authUser.user_profile_id, request.params.id, request.body) });
    },
    async deleteRecurring(request, response) {
      validateEmptyBody(request.body);
      response.json(await doctorAvailabilityService.deleteRecurring(request.authUser.user_profile_id, request.params.id));
    },
    async listPublished(request, response) {
      response.json({ published_availability: await doctorAvailabilityService.listPublished(request.authUser.user_profile_id) });
    },
    async createPublished(request, response) {
      response.status(201).json({ published_availability: await doctorAvailabilityService.createPublished(request.authUser.user_profile_id, request.body) });
    },
    async deletePublished(request, response) {
      validateEmptyBody(request.body);
      response.json(await doctorAvailabilityService.deletePublished(request.authUser.user_profile_id, request.params.id));
    },
    async listBlocked(request, response) {
      response.json({ blocked_times: await doctorAvailabilityService.listBlocked(request.authUser.user_profile_id) });
    },
    async createBlocked(request, response) {
      response.status(201).json({ blocked_time: await doctorAvailabilityService.createBlocked(request.authUser.user_profile_id, request.body) });
    },
    async deleteBlocked(request, response) {
      validateEmptyBody(request.body);
      response.json(await doctorAvailabilityService.deleteBlocked(request.authUser.user_profile_id, request.params.id));
    },
  };
}

export function createDoctorAvailabilityController({ doctorAvailabilityService }) {
  return {
    async listRecurring(request, response) {
      response.json({ availability: await doctorAvailabilityService.listOwnRecurring(request.authUser.user_profile_id) });
    },
    async listPublished(request, response) {
      response.json({ published_availability: await doctorAvailabilityService.listOwnPublished(request.authUser.user_profile_id) });
    },
    async listBlocked(request, response) {
      response.json({ blocked_times: await doctorAvailabilityService.listOwnBlocked(request.authUser.user_profile_id) });
    },
  };
}

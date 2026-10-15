export async function invokeSmsReminderWorkflow(service, method, payload) {
  if (!service?.[method]) return;
  try {
    await service[method](payload);
  } catch {
    try {
      service.logWorkflowFailure?.(method, payload?.appointmentId);
    } catch {
      // Reminder side effects must never roll back an appointment transition.
    }
  }
}

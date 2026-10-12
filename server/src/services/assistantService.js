export function createAssistantService({ privacyGateway, responseProvider }) {
  return Object.freeze({
    respond(message) {
      const classification = privacyGateway.classify(message);
      return Object.freeze({
        reply: responseProvider.reply(message, classification),
        intent: classification.intent,
      });
    },
  });
}


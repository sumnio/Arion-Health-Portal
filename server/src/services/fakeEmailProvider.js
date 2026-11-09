export function createFakeEmailProvider({ capture } = {}) {
  const deliveries = capture ?? [];
  const failNextTypes = new Set();
  return Object.freeze({
    name: 'fake',
    deliveries,
    failNext(type) { failNextTypes.add(type); },
    async send(message) {
      if (failNextTypes.delete(message.type)) throw new Error('Synthetic email delivery failure.');
      deliveries.push(structuredClone(message));
      return { provider: 'fake', delivered: true, messageId: `fake-${deliveries.length}` };
    },
  });
}

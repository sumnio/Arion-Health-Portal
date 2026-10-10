export function createFakeEmailProvider({ capture } = {}) {
  const deliveries = capture ?? [];
  return Object.freeze({
    name: 'fake',
    deliveries,
    async send(message) {
      deliveries.push(structuredClone(message));
      return { provider: 'fake', delivered: true, messageId: `fake-${deliveries.length}` };
    },
  });
}

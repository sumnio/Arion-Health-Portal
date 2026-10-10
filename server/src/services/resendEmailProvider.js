const RESEND_EMAIL_ENDPOINT = 'https://api.resend.com/emails';

export function createResendEmailProvider({ apiKey, from, fetchImpl = fetch }) {
  if (!apiKey || !from) throw new Error('Resend provider configuration is incomplete.');
  return Object.freeze({
    name: 'resend',
    async send(message) {
      const response = await fetchImpl(RESEND_EMAIL_ENDPOINT, {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error('Transactional email provider rejected the request.');
      const body = await response.json();
      return { provider: 'resend', delivered: true, messageId: body.id ?? null };
    },
  });
}

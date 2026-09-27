import { createRequire } from 'node:module';

const requireFromServer = createRequire(new URL('../../server/package.json', import.meta.url));
const { generate } = requireFromServer('otplib');

export async function currentTotp(secret) {
  return generate({ secret });
}

export function invalidTotp(validCode) {
  const last = Number(validCode.at(-1));
  return `${validCode.slice(0, -1)}${(last + 1) % 10}`;
}

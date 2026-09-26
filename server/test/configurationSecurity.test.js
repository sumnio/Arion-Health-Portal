import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));

function envKeys(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .map(line => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1])
    .filter(Boolean);
}

test('frontend environment files expose only the public API base URL', () => {
  for (const name of ['.env', '.env.example']) {
    const keys = envKeys(`${root}${name}`);
    assert.ok(keys.every(key => key === 'VITE_API_BASE_URL'));
    assert.ok(keys.every(key => !/(SECRET|PASSWORD|TOKEN|PRIVATE|MONGO|ADMIN)/i.test(key)));
  }
});

test('backend example contains placeholders and gitignore protects real environment files', () => {
  const example = readFileSync(`${root}server/.env.example`, 'utf8');
  assert.match(example, /^MONGODB_URI=\s*$/m);
  assert.match(example, /^AUTH_SECRET=\s*$/m);
  assert.match(example, /^MFA_ENCRYPTION_KEY=\s*$/m);
  assert.match(example, /^ADMIN_PASSWORD=\s*$/m);
  assert.doesNotMatch(example, /mongodb(?:\+srv)?:\/\/[^\s:@]+:[^\s@]+@/i);

  const gitignore = readFileSync(`${root}.gitignore`, 'utf8');
  assert.match(gitignore, /^\.env$/m);
  assert.match(gitignore, /^\.env\.\*$/m);
  assert.match(gitignore, /^!\.env\.example$/m);
});

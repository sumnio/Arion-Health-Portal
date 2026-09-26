import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createAdminAccount, readAdminEnvironment } from '../scripts/createAdmin.js';
import { passwordService } from '../src/services/passwordService.js';
import { validateRegistration } from '../src/validation/authValidation.js';

const values = {
  email: 'admin@example.com',
  password: 'SecurePassword123!',
  display_name: 'Portal Admin',
  contact_number: '09170000000',
};

function supportedSession() {
  return { async withTransaction(callback) { await callback(); }, async endSession() {} };
}

test('Admin environment validation normalizes email and requires approved fields', () => {
  assert.deepEqual(readAdminEnvironment({
    ADMIN_EMAIL: ' ADMIN@Example.COM ', ADMIN_PASSWORD: values.password,
    ADMIN_DISPLAY_NAME: ' Portal Admin ', ADMIN_CONTACT_NUMBER: ' 09170000000 ',
  }), values);
  assert.throws(() => readAdminEnvironment({}), /ADMIN_PASSWORD is required/);
  assert.throws(() => readAdminEnvironment({ ...values, ADMIN_PASSWORD: 'short' }), /at least 8/);
});

test('bootstrap creates one active Admin profile and a linked hashed AuthAccount', async () => {
  const written = { profiles: [], accounts: [] };
  const models = {
    UserProfile: { async create(documents) { const profile = { _id: 'profile-1', ...documents[0] }; written.profiles.push(profile); return [profile]; }, async deleteOne() {} },
    AuthAccount: { async exists() { return false; }, async create(documents) { const account = { _id: 'account-1', ...documents[0] }; written.accounts.push(account); return [account]; }, async deleteMany() {} },
  };
  const result = await createAdminAccount(values, { models, startSession: async () => supportedSession() });
  assert.equal(result.created, true);
  assert.equal(written.profiles.length, 1); assert.equal(written.accounts.length, 1);
  assert.equal(written.profiles[0].role, 'admin'); assert.equal(written.profiles[0].status, 'active');
  assert.equal(written.accounts[0].user_profile_id, 'profile-1'); assert.equal(written.accounts[0].email, values.email);
  assert.notEqual(written.accounts[0].password_hash, values.password);
  assert.equal(await passwordService.compare(values.password, written.accounts[0].password_hash), true);
  assert.equal(JSON.stringify(written).includes(values.password), false);
});

test('duplicate email exits without changing any account or profile', async () => {
  let writes = 0; let sessions = 0;
  const models = {
    UserProfile: { async create() { writes += 1; } },
    AuthAccount: { async exists() { return true; }, async create() { writes += 1; } },
  };
  const result = await createAdminAccount(values, { models, startSession: async () => { sessions += 1; return supportedSession(); } });
  assert.deepEqual(result, { created: false, reason: 'exists' }); assert.equal(writes, 0); assert.equal(sessions, 0);
});

test('standalone Mongo fallback removes a partial profile when account creation fails', async () => {
  const deleted = [];
  const models = {
    UserProfile: { async create(documents) { return [{ _id: 'partial-profile', ...documents[0] }]; }, async deleteOne(query) { deleted.push(['profile', query]); } },
    AuthAccount: { async exists() { return false; }, async create() { throw new Error('write failed'); }, async deleteMany(query) { deleted.push(['account', query]); } },
  };
  const session = { async withTransaction() { throw Object.assign(new Error('Transaction numbers are only allowed on a replica set'), { code: 20 }); }, async endSession() {} };
  await assert.rejects(() => createAdminAccount(values, { models, startSession: async () => session }), /write failed/);
  assert.deepEqual(deleted, [['account', { user_profile_id: 'partial-profile' }], ['profile', { _id: 'partial-profile' }]]);
});

test('bootstrap has no HTTP route or role input and public registration remains Patient-only', async () => {
  const source = await readFile(new URL('../scripts/createAdmin.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /Patient\.create|Doctor\.create|Staff\.create|Router\(|app\.(?:post|use)/);
  assert.match(source, /role: 'admin'/); assert.doesNotMatch(source, /ADMIN_ROLE/);
  assert.throws(() => validateRegistration({ role: 'admin' }), error => error.code === 'PUBLIC_ROLE_NOT_ALLOWED');
});

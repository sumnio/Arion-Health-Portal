import mongoose from 'mongoose';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { loadConfig } from '../src/config/env.js';
import { AuthAccount, UserProfile } from '../src/models/index.js';
import { passwordService } from '../src/services/passwordService.js';
import { validateLogin } from '../src/validation/authValidation.js';

function required(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required.`);
  return value.trim();
}

export function readAdminEnvironment(environment = process.env) {
  const password = required(environment.ADMIN_PASSWORD, 'ADMIN_PASSWORD');
  if (password.length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters.');
  const email = validateLogin({ email: environment.ADMIN_EMAIL, password }).email;
  return {
    email,
    password,
    display_name: required(environment.ADMIN_DISPLAY_NAME, 'ADMIN_DISPLAY_NAME'),
    contact_number: required(environment.ADMIN_CONTACT_NUMBER, 'ADMIN_CONTACT_NUMBER'),
  };
}

function transactionUnavailable(error) {
  return error?.code === 20 || /Transaction numbers are only allowed|replica set/i.test(error?.message ?? '');
}

function duplicateKey(error) { return error?.code === 11000; }

export async function createAdminAccount(input, {
  models = { AuthAccount, UserProfile },
  passwords = passwordService,
  startSession = () => mongoose.startSession(),
} = {}) {
  if (await models.AuthAccount.exists({ email: input.email })) return { created: false, reason: 'exists' };
  const passwordHash = await passwords.hash(input.password);
  let profileId = null;
  const create = async (session) => {
    const options = session ? { session } : undefined;
    const [profile] = await models.UserProfile.create([{
      display_name: input.display_name,
      role: 'admin',
      contact_number: input.contact_number,
      status: 'active',
    }], options);
    profileId = profile._id;
    const [account] = await models.AuthAccount.create([{
      user_profile_id: profile._id,
      email: input.email,
      password_hash: passwordHash,
    }], options);
    return { profile, account };
  };
  const session = await startSession();
  try {
    try {
      let result;
      await session.withTransaction(async () => { result = await create(session); });
      return { created: true, ...result };
    } catch (error) {
      if (!transactionUnavailable(error)) {
        if (duplicateKey(error)) return { created: false, reason: 'exists' };
        throw error;
      }
      profileId = null;
      try { return { created: true, ...await create() }; }
      catch (fallbackError) {
        if (profileId) {
          await models.AuthAccount.deleteMany({ user_profile_id: profileId });
          await models.UserProfile.deleteOne({ _id: profileId });
        }
        if (duplicateKey(fallbackError)) return { created: false, reason: 'exists' };
        throw fallbackError;
      }
    }
  } finally { await session.endSession(); }
}

export async function runCreateAdmin(environment = process.env) {
  let input;
  try { input = readAdminEnvironment(environment); }
  catch (error) { console.error(`Admin account was not created: ${error.message}`); return 1; }
  const config = loadConfig(environment);
  try {
    await connectDatabase(config.mongoUri);
    await Promise.all([AuthAccount.init(), UserProfile.init()]);
    const result = await createAdminAccount(input);
    console.info(result.created
      ? 'Admin account created successfully. Use the normal /login page to sign in.'
      : 'An account already exists for the configured Admin email. No changes were made.');
    return 0;
  } catch {
    console.error('Admin account was not created. Check the server configuration and database connection.');
    return 1;
  } finally { await disconnectDatabase(); }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) process.exitCode = await runCreateAdmin();

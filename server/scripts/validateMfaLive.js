import { randomUUID } from 'node:crypto';
import { generate } from 'otplib';
import { createApp } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { loadConfig, validateRuntimeConfig } from '../src/config/env.js';
import { AuthAccount, UserProfile } from '../src/models/index.js';
import { passwordService } from '../src/services/passwordService.js';

function cookie(response, name) {
  const values = response.headers.getSetCookie?.() ?? [response.headers.get('set-cookie')];
  return values.find(item => item?.startsWith(`${name}=`))?.split(';')[0] ?? '';
}

async function request(base, path, { method = 'GET', body, cookieValue } = {}) {
  return fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookieValue ? { cookie: cookieValue } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  const config = validateRuntimeConfig(loadConfig());
  const suffix = randomUUID();
  const email = `mfa-validation-${suffix}@example.test`;
  const password = `Validation-${randomUUID()}!`;
  let profile;
  let server;
  try {
    await connectDatabase(config.mongoUri);
    profile = await UserProfile.create({
      display_name: 'Disposable MFA Validation Admin',
      role: 'admin',
      contact_number: '00000000000',
      status: 'active',
    });
    await AuthAccount.create({
      user_profile_id: profile._id,
      email,
      password_hash: await passwordService.hash(password),
    });

    server = createApp({ ...config, port: 0 }).listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const base = `http://127.0.0.1:${server.address().port}`;
    const loginBody = { email, password };

    const firstLogin = await request(base, '/api/auth/login', { method: 'POST', body: loginBody });
    assert(firstLogin.status === 200, 'First Admin password step failed.');
    assert((await firstLogin.json()).status === 'MFA_SETUP_REQUIRED', 'First Admin login did not require MFA setup.');
    const firstChallenge = cookie(firstLogin, 'arion_mfa_challenge');
    assert(firstChallenge, 'MFA setup challenge cookie was not issued.');
    assert((await request(base, '/api/auth/me', { cookieValue: firstChallenge })).status === 401, 'MFA challenge authorized a protected session.');

    const setupResponse = await request(base, '/api/auth/mfa/setup', { method: 'POST', cookieValue: firstChallenge });
    assert(setupResponse.status === 200, 'MFA setup failed.');
    const setup = await setupResponse.json();
    assert(setup.otpauth_uri?.startsWith('otpauth://totp/'), 'MFA setup did not return an authenticator URI.');
    const setupCode = await generate({ secret: setup.manual_key });
    const setupVerification = await request(base, '/api/auth/mfa/verify-setup', {
      method: 'POST', cookieValue: firstChallenge, body: { code: setupCode },
    });
    assert(setupVerification.status === 200, 'MFA enrollment verification failed.');
    const firstSession = cookie(setupVerification, 'arion_auth');
    assert(firstSession, 'MFA enrollment did not issue a full session.');
    assert((await request(base, '/api/auth/me', { cookieValue: firstSession })).status === 200, 'MFA session could not access /me.');
    assert((await request(base, '/api/admin/doctors', { cookieValue: firstSession })).status === 200, 'Verified Admin session could not access Admin APIs.');
    assert((await request(base, '/api/auth/mfa/verify-setup', {
      method: 'POST', cookieValue: firstChallenge, body: { code: setupCode },
    })).status === 401, 'Consumed setup challenge was replayed.');

    const enrolledLogin = await request(base, '/api/auth/login', { method: 'POST', body: loginBody });
    assert((await enrolledLogin.json()).status === 'MFA_REQUIRED', 'Enrolled Admin login did not require MFA verification.');
    const enrolledChallenge = cookie(enrolledLogin, 'arion_mfa_challenge');
    const loginCode = await generate({ secret: setup.manual_key });
    const verification = await request(base, '/api/auth/mfa/verify', {
      method: 'POST', cookieValue: enrolledChallenge, body: { code: loginCode },
    });
    assert(verification.status === 200, 'Enrolled Admin TOTP verification failed.');
    assert(cookie(verification, 'arion_auth'), 'Enrolled Admin verification did not issue a full session.');
    console.info('Live Admin MFA validation passed; disposable validation records will be removed.');
    return 0;
  } catch {
    console.error('Live Admin MFA validation failed. Check backend configuration and database availability.');
    return 1;
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (profile?._id) {
      await AuthAccount.deleteMany({ user_profile_id: profile._id });
      await UserProfile.deleteOne({ _id: profile._id });
    }
    await disconnectDatabase();
  }
}

process.exitCode = await run();

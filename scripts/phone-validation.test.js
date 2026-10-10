import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canonicalizePhilippineMobile,
  philippineMobileInput,
  validatePhilippineMobile,
} from '../src/services/phoneNumber.js';

test('Philippine mobile validation accepts only the canonical 09 and 11-digit shape', () => {
  assert.equal(validatePhilippineMobile('09171234567'), '');
  assert.equal(validatePhilippineMobile('0917123'), 'Phone number must be 11 digits.');
  assert.equal(validatePhilippineMobile('091712345678'), 'Phone number must be 11 digits.');
  assert.equal(validatePhilippineMobile('08171234567'), 'Phone number must start with 09.');
  assert.equal(validatePhilippineMobile('0917abc4567'), 'Invalid phone number.');
  assert.equal(validatePhilippineMobile('+639171234567'), 'Invalid phone number.');
});

test('space-formatted input is canonicalized without stripping other malformed characters', () => {
  assert.equal(validatePhilippineMobile('0917 123 4567'), '');
  assert.equal(canonicalizePhilippineMobile('0917 123 4567'), '09171234567');
  assert.equal(canonicalizePhilippineMobile('0917abc4567'), '0917abc4567');
  assert.deepEqual(philippineMobileInput('0917 123 4567'), { accepted: true, value: '09171234567', error: '' });
  assert.equal(philippineMobileInput('0917abc4567').accepted, false);
  assert.deepEqual(philippineMobileInput('091712345678'), { accepted: false });
});

test('a twelfth digit is ignored without turning an existing valid number invalid', () => {
  const current = '09171234567';
  const attempted = philippineMobileInput(`${current}8`);
  assert.equal(attempted.accepted, false);
  assert.equal(validatePhilippineMobile(current), '');
});

test('optional emergency mobile numbers allow blank but validate provided values', () => {
  assert.equal(validatePhilippineMobile('', { optional: true }), '');
  assert.equal(validatePhilippineMobile('09175550123', { optional: true }), '');
  assert.equal(validatePhilippineMobile('0917555', { optional: true }), 'Phone number must be 11 digits.');
});

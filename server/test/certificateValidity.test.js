import assert from 'node:assert/strict';
import test from 'node:test';
import { certificateValidityStatus, CERTIFICATE_VALIDITY_STATUSES } from '../src/services/certificateValidity.js';

test('legacy certificates keep null validity without a fabricated expiration date', () => {
  assert.equal(certificateValidityStatus(null), CERTIFICATE_VALIDITY_STATUSES.LEGACY);
});

test('same-day and future certificates are active in Asia/Manila', () => {
  const now = new Date('2026-10-15T15:59:59.999Z');
  assert.equal(certificateValidityStatus('2026-10-15', { now }), CERTIFICATE_VALIDITY_STATUSES.ACTIVE);
  assert.equal(certificateValidityStatus('2026-10-16', { now }), CERTIFICATE_VALIDITY_STATUSES.ACTIVE);
});

test('a certificate becomes expired only after its Valid Until clinic date', () => {
  assert.equal(certificateValidityStatus('2026-10-15', { now: new Date('2026-10-15T16:00:00.000Z') }), CERTIFICATE_VALIDITY_STATUSES.EXPIRED);
});

test('certificate validity honors the configured clinic timezone boundary', () => {
  const instant = new Date('2026-10-15T16:00:00.000Z');
  assert.equal(certificateValidityStatus('2026-10-15', { now: instant, timeZone: 'Asia/Manila' }), 'expired');
  assert.equal(certificateValidityStatus('2026-10-15', { now: instant, timeZone: 'UTC' }), 'active');
});

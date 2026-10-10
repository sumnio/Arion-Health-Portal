export const PHILIPPINE_MOBILE_PATTERN = /^09\d{9}$/;

export function canonicalizePhilippineMobile(value) {
  return String(value ?? '').replace(/ /g, '');
}

export function validatePhilippineMobile(value, { optional = false } = {}) {
  const raw = String(value ?? '');
  if (!raw.trim()) return optional ? '' : 'Phone number is required.';
  const canonical = canonicalizePhilippineMobile(raw);
  if (!/^\d+$/.test(canonical)) return 'Invalid phone number.';
  if (canonical.length !== 11) return 'Phone number must be 11 digits.';
  if (!canonical.startsWith('09')) return 'Phone number must start with 09.';
  return '';
}

export function philippineMobileInput(rawValue) {
  const canonical = canonicalizePhilippineMobile(rawValue);
  if (!/^\d*$/.test(canonical) || canonical.length > 11) return { accepted: false };
  return { accepted: true, value: canonical, error: '' };
}

export const philippineMobileInputAttributes = Object.freeze({
  type: 'tel',
  inputMode: 'numeric',
  pattern: '09[0-9]{9}',
  autoComplete: 'tel',
});

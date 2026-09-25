const timePattern = /^(?:[01]\d|2[0-3]):(?:00|30)$/;

export function createClinicConfig({
  timeZone = 'Asia/Manila',
  openTime = '',
  closeTime = '',
} = {}) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
  } catch {
    throw new Error('CLINIC_TIME_ZONE must be a valid IANA time zone.');
  }
  if (Boolean(openTime) !== Boolean(closeTime)) {
    throw new Error('CLINIC_OPEN_TIME and CLINIC_CLOSE_TIME must be configured together.');
  }
  if (openTime && (!timePattern.test(openTime) || !timePattern.test(closeTime) || openTime >= closeTime)) {
    throw new Error('Clinic hours must use ordered 30-minute HH:MM values.');
  }
  return Object.freeze({ timeZone, openTime: openTime || null, closeTime: closeTime || null });
}

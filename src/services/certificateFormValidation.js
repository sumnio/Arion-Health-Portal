import { clinicToday } from './dateTimeService.js';

export function validateCertificateDraft(values, issueDate = clinicToday()) {
  const errors = {};
  if (!values.purpose) errors.purpose = 'Select a purpose.';
  if (values.purpose === 'Other' && !values.custom_purpose.trim()) errors.custom_purpose = 'Specify the certificate purpose.';
  if (!values.diagnosis_summary.trim()) errors.diagnosis_summary = 'Enter a diagnosis summary.';
  if (!values.recommendation.trim()) errors.recommendation = 'Enter a short recommendation.';
  if (!values.valid_until) errors.valid_until = 'Choose a Valid Until date.';
  else if (values.valid_until < issueDate) errors.valid_until = 'Valid Until must be on or after the issue date.';
  return errors;
}

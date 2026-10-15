export const certificatePurposeOptions = Object.freeze([
  'Sick Leave',
  'School Absence',
  'Fit to Return',
  'Medical Consultation',
  'Follow-up Consultation',
  'Work Clearance',
  'Travel / General Purpose',
  'Other',
]);

const statementByPurpose = Object.freeze({
  'Sick Leave': 'This is to certify that the above-named patient was examined and consulted at Arion Health Clinic on the date indicated. Based on the clinical evaluation, the patient was advised to take the recommended period of rest.',
  'School Absence': 'This is to certify that the above-named patient was examined and consulted at Arion Health Clinic on the date indicated and was advised to rest during the recommended period.',
  'Fit to Return': 'This is to certify that the above-named patient was evaluated at Arion Health Clinic and, based on the clinical assessment, may return to regular duties as stated in the recommendation below.',
  'Medical Consultation': 'This is to certify that the above-named patient was examined and consulted at Arion Health Clinic on the date indicated.',
  'Follow-up Consultation': 'This is to certify that the above-named patient was seen for follow-up consultation at Arion Health Clinic on the date indicated.',
  'Work Clearance': 'This is to certify that the above-named patient was evaluated at Arion Health Clinic for work-related medical clearance.',
  'Travel / General Purpose': 'This is to certify that the above-named patient was examined and consulted at Arion Health Clinic on the date indicated.',
  Other: 'This is to certify that the above-named patient was examined and consulted at Arion Health Clinic on the date indicated.',
});

export function certificatePurposeLabel(purpose, customPurpose = '') {
  return purpose === 'Other' ? customPurpose.trim() || 'Specified purpose' : purpose;
}

export function certificateDraftStatement(purpose, customPurpose = '') {
  if (!certificatePurposeOptions.includes(purpose)) return 'Select a purpose to preview the certification statement.';
  return `${statementByPurpose[purpose]} This certificate is issued upon the request of the patient for ${certificatePurposeLabel(purpose, customPurpose)}.`;
}

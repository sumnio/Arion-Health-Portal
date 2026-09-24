// Patient Profile view model. Its camelCase keys correspond to the approved
// Patient fields (full_name, contact_number, address, split emergency-contact
// fields, allergies, and is_pwd) at the service/backend adapter boundary.
export const patientProfileData = {
  fullName: 'Demo Patient', dob: '1990-01-15', sex: 'Male', contactNumber: '0917 123 4567',
  email: 'demo.patient@example.com', address: '123 Mabini Street, Quezon City',
  emergencyName: 'Maria Dela Cruz', emergencyNumber: '0918 765 4321', relationship: 'Mother',
  allergies: ['Penicillin', 'Peanuts'], isPwd: false,
};

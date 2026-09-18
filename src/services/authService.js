// Mock-only boundary. No network, session, credential storage, or account creation.
const roles = ['patient', 'doctor', 'staff', 'admin'];
export const authService = {
  async login({ email, password, role }) {
    if (!email?.trim() || !password?.trim() || !roles.includes(role)) {
      throw new Error('Enter an email, a password, and a valid preview role.');
    }
    return { role };
  },
  async registerPatient({ display_name, email, contact_number, dob, sex, password, confirmPassword }) {
    if (![display_name, email, contact_number, dob, sex, password].every(value => value?.trim())) {
      throw new Error('Complete all required fields.');
    }
    if (password !== confirmPassword) throw new Error('Passwords do not match.');
    const date = new Date(dob + 'T00:00:00');
    if (Number.isNaN(date.getTime()) || date > new Date()) throw new Error('Enter a valid date of birth that is not in the future.');
    return { role: 'patient', mock: true };
  },
};


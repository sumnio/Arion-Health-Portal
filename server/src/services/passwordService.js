import bcrypt from 'bcryptjs';

const WORK_FACTOR = 12;

export const passwordService = {
  hash(password) {
    return bcrypt.hash(password, WORK_FACTOR);
  },
  compare(password, passwordHash) {
    return bcrypt.compare(password, passwordHash);
  },
};

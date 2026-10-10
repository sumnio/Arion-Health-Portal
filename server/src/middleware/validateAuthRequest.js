import {
  validateForgotPassword,
  validateLogin,
  validateMfaCode,
  validatePasswordReset,
  validatePasswordResetSession,
  validateRegistration,
} from '../validation/authValidation.js';

function validator(validate) {
  return function validateRequest(request, _response, next) {
    try {
      request.validatedBody = validate(request.body);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const validateRegistrationRequest = validator(validateRegistration);
export const validateLoginRequest = validator(validateLogin);
export const validateMfaCodeRequest = validator(validateMfaCode);
export const validateEmailVerificationCodeRequest = validator(validateMfaCode);
export const validateForgotPasswordRequest = validator(validateForgotPassword);
export const validatePasswordResetSessionRequest = validator(validatePasswordResetSession);
export const validatePasswordResetRequest = validator(validatePasswordReset);

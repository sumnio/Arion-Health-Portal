import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import { ApiError, setUnauthorizedHandler } from '../services/apiClient.js';
import { authService } from '../services/authService.js';

const AuthContext = createContext(null);

export const initialAuthState = {
  user: null,
  status: 'initializing',
  accessMessage: '',
  mfaState: null,
  mfaSetup: null,
};

export function authStateReducer(state, action) {
  switch (action.type) {
    case 'authenticated':
      return { ...initialAuthState, user: action.user, status: 'authenticated' };
    case 'guest':
      return { ...initialAuthState, status: 'guest', accessMessage: action.message || '' };
    case 'mfa':
      return {
        ...initialAuthState,
        status: 'mfa_pending',
        mfaState: action.mfaState,
        mfaSetup: action.mfaSetup ?? null,
      };
    default:
      return state;
  }
}

export function classifySessionError(error) {
  if (error instanceof ApiError && error.status === 401) return { type: 'guest' };
  if (error instanceof ApiError && error.status === 403 && error.code === 'ACCOUNT_INACTIVE') {
    return { type: 'guest', message: 'This account is inactive. Contact an administrator for access.' };
  }
  return { type: 'guest', message: error?.message || 'Unable to restore your session. Please log in again.' };
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authStateReducer, initialAuthState);

  const refreshCurrentUser = useCallback(async () => {
    try {
      const user = await authService.getCurrentUser();
      dispatch({ type: 'authenticated', user });
      return user;
    } catch (error) {
      dispatch(classifySessionError(error));
      return null;
    }
  }, []);

  useEffect(() => {
    const clearHandler = setUnauthorizedHandler(() => dispatch({ type: 'guest' }));
    refreshCurrentUser();
    return clearHandler;
  }, [refreshCurrentUser]);

  const login = useCallback(async (credentials) => {
    const result = await authService.login(credentials);
    if (result.user) {
      dispatch({ type: 'authenticated', user: result.user });
      return result;
    }
    if (result.status === 'MFA_SETUP_REQUIRED') {
      const setup = await authService.startMfaSetup();
      dispatch({ type: 'mfa', mfaState: 'setup', mfaSetup: setup });
      return { status: result.status };
    }
    if (result.status === 'MFA_REQUIRED') {
      dispatch({ type: 'mfa', mfaState: 'verify' });
      return { status: result.status };
    }
    throw new Error('The login response was not recognized.');
  }, []);
  const verifyMfa = useCallback(async (code) => {
    const result = state.mfaState === 'setup'
      ? await authService.verifyMfaSetup(code)
      : await authService.verifyMfa(code);
    dispatch({ type: 'authenticated', user: result.user });
    return result.user;
  }, [state.mfaState]);
  const cancelMfa = useCallback(async () => {
    try { await authService.logout(); }
    finally { dispatch({ type: 'guest' }); }
  }, []);
  const register = useCallback((payload) => authService.registerPatient(payload), []);
  const logout = useCallback(async () => {
    try { await authService.logout(); }
    finally { dispatch({ type: 'guest' }); }
  }, []);

  const value = useMemo(() => ({
    ...state,
    authenticated: state.status === 'authenticated',
    login,
    verifyMfa,
    cancelMfa,
    register,
    logout,
    refreshCurrentUser,
  }), [state, login, verifyMfa, cancelMfa, register, logout, refreshCurrentUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}

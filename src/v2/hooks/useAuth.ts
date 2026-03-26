import { useState, useCallback, useEffect } from 'react';
import {
  isAuthenticated as checkAuth,
  getMe,
  login as apiLogin,
  register as apiRegister,
  clearTokens,
} from '@/v2/lib/api';

interface User {
  email: string;
  org_name: string;
}

type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; user: User };

export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  const checkSession = useCallback(async () => {
    if (!checkAuth()) {
      setState({ status: 'unauthenticated' });
      return;
    }
    try {
      const user = await getMe();
      setState({ status: 'authenticated', user });
    } catch {
      clearTokens();
      setState({ status: 'unauthenticated' });
    }
  }, []);

  useEffect(() => { checkSession(); }, [checkSession]);

  const login = useCallback(async (email: string, password: string) => {
    await apiLogin(email, password);
    await checkSession();
  }, [checkSession]);

  const register = useCallback(async (email: string, password: string, orgName: string) => {
    await apiRegister(email, password, orgName);
    await checkSession();
  }, [checkSession]);

  const logout = useCallback(() => {
    clearTokens();
    setState({ status: 'unauthenticated' });
  }, []);

  return { ...state, login, register, logout };
}

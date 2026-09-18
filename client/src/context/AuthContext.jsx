import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi, setToken as persistToken, getToken } from '../api/client';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  useEffect(() => {
    if (!getToken()) return;
    authApi
      .me()
      .then((d) => setUser(d.user))
      .catch(() => persistToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const d = await authApi.login({ email, password });
    persistToken(d.token);
    setUser(d.user);
    return d.user;
  };

  const register = async (payload) => {
    const d = await authApi.register(payload);
    persistToken(d.token);
    setUser(d.user);
    return d;
  };

  const logout = () => {
    persistToken(null);
    setUser(null);
  };

  /** Re-fetch the current user (e.g. after a license re-submit changes status). */
  const refreshUser = useCallback(async () => {
    if (!getToken()) return;
    try {
      const d = await authApi.me();
      setUser(d.user);
    } catch {
      /* keep current state */
    }
  }, []);

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);

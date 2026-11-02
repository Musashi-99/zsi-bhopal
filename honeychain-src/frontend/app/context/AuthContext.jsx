import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const qc = useQueryClient();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api('/api/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, []);

  // Another tab signed in as a different role: the cookie changed but this tab still shows the old user.
  useEffect(() => {
    const resync = () => api('/api/auth/me').then((d) => { setUser(d.user); qc.clear(); }).catch(() => { setUser(null); qc.clear(); });
    window.addEventListener('aranya:session-stale', resync);
    return () => window.removeEventListener('aranya:session-stale', resync);
  }, [qc]);

  const login = useCallback(async (email, password, portal) => {
    const d = await api('/api/auth/login', { method: 'POST', body: { email, password, portal } });
    qc.clear();
    setUser(d.user);
    return d.user;
  }, [qc]);

  const register = useCallback(async (body) => {
    const d = await api('/api/auth/register', { method: 'POST', body });
    qc.clear();
    setUser(d.user);
    return d.user;
  }, [qc]);

  const logout = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    qc.clear();
    setUser(null);
  }, [qc]);

  const value = useMemo(() => ({ user, ready, login, register, logout, setUser }), [user, ready, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

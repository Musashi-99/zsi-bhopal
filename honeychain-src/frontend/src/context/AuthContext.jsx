import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api('/api/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, []);

  const value = useMemo(() => ({
    user,
    ready,
    async login(email, password) {
      const data = await api('/api/auth/login', { method: 'POST', body: { email, password } });
      setUser(data.user);
      return data.user;
    },
    async register(body) {
      const data = await api('/api/auth/register', { method: 'POST', body });
      setUser(data.user);
      return data.user;
    },
    async logout() {
      await api('/api/auth/logout', { method: 'POST' });
      setUser(null);
    },
    async refresh() {
      const data = await api('/api/auth/me');
      setUser(data.user);
      return data.user;
    },
  }), [user, ready]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

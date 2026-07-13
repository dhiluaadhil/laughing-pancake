import { createContext, useContext, useState, useCallback } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

const STORAGE_KEY_TOKEN = 'campuslink_token';
const STORAGE_KEY_USER  = 'campuslink_user';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY_TOKEN));
  const [user,  setUser]  = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_USER);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const saveSession = useCallback((userData, tokenData) => {
    setUser(userData);
    setToken(tokenData);
    localStorage.setItem(STORAGE_KEY_TOKEN, tokenData);
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(userData));
  }, []);

  const login = useCallback(async (username, password) => {
    // Django REST simplejwt expects 'username', and returns { access, refresh }
    const { data: tokenData } = await api.post('/auth/login/', { username, password });
    
    // Temporarily set token in localStorage so the next request uses it
    localStorage.setItem(STORAGE_KEY_TOKEN, tokenData.access);
    
    // Fetch the authenticated user's details
    const { data: userData } = await api.get('/users/me/');
    
    saveSession(userData, tokenData.access);
    return userData;
  }, [saveSession]);

  const register = useCallback(async (payload) => {
    const { data: userData } = await api.post('/users/', payload);
    // After registration, typically we'd login automatically or require login
    // Let's just login for them
    return login(payload.username || payload.email, payload.password);
  }, [login]);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_USER);
  }, []);

  const updateUser = useCallback((updates) => {
    setUser((prev) => {
      const updated = { ...prev, ...updates };
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, updateUser, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { rehearseApi } from '../lib/api';
import type { User } from '../lib/api';

interface AuthContextType {
  user: User | null;
  sessionId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load session from localStorage on mount
  useEffect(() => {
    const loadSession = async () => {
      const storedSessionId = localStorage.getItem('sessionId');
      const storedUser = localStorage.getItem('user');

      if (storedSessionId && storedUser) {
        try {
          // Verify session is still valid
          const response = await rehearseApi.getCurrentUser(storedSessionId);
          setUser(response.data.user);
          setSessionId(storedSessionId);
        } catch (error) {
          // Session invalid, clear storage
          localStorage.removeItem('sessionId');
          localStorage.removeItem('user');
        }
      }
      setIsLoading(false);
    };

    loadSession();
  }, []);

  const login = async () => {
    try {
      const response = await rehearseApi.getAuthUrl();
      window.location.href = response.data.authUrl;
    } catch (error) {
      console.error('Failed to initiate login:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (sessionId) {
        await rehearseApi.logout(sessionId);
      }
    } catch (error) {
      console.error('Failed to logout:', error);
    } finally {
      setUser(null);
      setSessionId(null);
      localStorage.removeItem('sessionId');
      localStorage.removeItem('user');
    }
  };

  const refreshUser = async () => {
    if (!sessionId) return;

    try {
      const response = await rehearseApi.getCurrentUser(sessionId);
      setUser(response.data.user);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    } catch (error) {
      console.error('Failed to refresh user:', error);
      await logout();
    }
  };

  const value = {
    user,
    sessionId,
    isLoading,
    isAuthenticated: !!user && !!sessionId,
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Helper function to set session after OAuth callback
export function setAuthSession(user: User, sessionId: string) {
  localStorage.setItem('sessionId', sessionId);
  localStorage.setItem('user', JSON.stringify(user));
}

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, UserRole } from '../types';
import { authApi } from '../lib/api/auth';
import { companyApi } from '../lib/api/company';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  role: UserRole | null;
  companyId: string | null;
  companyName: string | null;
  hasCompany: boolean;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, preferredRole?: UserRole) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateCompanyAssociation: (companyId: string, role?: UserRole) => void;
  setCompanySession: (companyId: string, role?: UserRole, name?: string) => void;
  switchRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fetch company name dynamically whenever user.company_id changes
  useEffect(() => {
    if (user?.company_id) {
      companyApi
        .getCompany(user.company_id)
        .then((c) => setCompanyName(c.company_name))
        .catch(() => setCompanyName(null));
    } else {
      setCompanyName(null);
    }
  }, [user?.company_id]);

  // Initialize session from sessionStorage on app mount
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = sessionStorage.getItem('nexora_token');
      if (storedToken) {
        setToken(storedToken);
        try {
          const profile = await authApi.getMe();
          setUser(profile);
        } catch {
          sessionStorage.removeItem('nexora_token');
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();

    // Listen to 401 token expiration events from api client
    const handleAuthExpired = () => {
      setToken(null);
      setUser(null);
    };
    window.addEventListener('auth:expired', handleAuthExpired);
    return () => window.removeEventListener('auth:expired', handleAuthExpired);
  }, []);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const res = await authApi.login(email, pass);
      sessionStorage.setItem('nexora_token', res.access_token);
      setToken(res.access_token);
      if (res.user) {
        setUser(res.user);
      } else {
        const profile = await authApi.getMe();
        setUser(profile);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, pass: string, preferredRole: UserRole = 'admin') => {
    setIsLoading(true);
    try {
      const res = await authApi.register(email, pass);
      sessionStorage.setItem('nexora_token', res.access_token);
      sessionStorage.setItem('nexora_preferred_role', preferredRole);
      setToken(res.access_token);
      if (res.user) {
        setUser({ ...res.user, role: preferredRole });
      } else {
        const profile = await authApi.getMe();
        setUser({ ...profile, role: preferredRole });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = useCallback(() => {
    sessionStorage.removeItem('nexora_token');
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const profile = await authApi.getMe();
      setUser(profile);
    } catch {
      logout();
    }
  }, [logout]);

  const updateCompanyAssociation = (companyId: string, role: UserRole = 'admin') => {
    if (user) {
      setUser({
        ...user,
        company_id: companyId,
        role: role,
      });
    }
  };

  const setCompanySession = (companyId: string, role: UserRole = 'admin', name?: string) => {
    if (user) {
      setUser({
        ...user,
        company_id: companyId,
        role: role,
      });
    }
    if (name) {
      setCompanyName(name);
    }
  };

  const switchRole = (newRole: UserRole) => {
    if (user) {
      setUser({
        ...user,
        role: newRole,
      });
      sessionStorage.setItem('nexora_preferred_role', newRole);
    }
  };

  const role = user?.role || null;
  const companyId = user?.company_id || null;
  const isAuthenticated = !!token && !!user;
  const hasCompany = !!companyId;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        role,
        companyId,
        companyName,
        hasCompany,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
        updateCompanyAssociation,
        setCompanySession,
        switchRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

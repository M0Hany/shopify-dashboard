import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import Cookies from 'js-cookie';

export type AppRole = 'admin' | 'courier';

interface AuthContextType {
  isAuthenticated: boolean;
  role: AppRole | null;
  login: (params: { role: AppRole; username?: string; password?: string }) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [role, setRole] = useState<AppRole | null>(null);

  // Check for authentication cookie on initial load
  useEffect(() => {
    const isLoggedIn = Cookies.get('isLoggedIn');
    const savedRole = Cookies.get('appRole');
    if (isLoggedIn === 'true' && (savedRole === 'admin' || savedRole === 'courier')) {
      setIsAuthenticated(true);
      setRole(savedRole);
    }
  }, []);

  const login = ({ role, username, password }: { role: AppRole; username?: string; password?: string }): boolean => {
    if (role === 'courier') {
      setIsAuthenticated(true);
      setRole('courier');
      Cookies.set('isLoggedIn', 'true', { expires: 7 });
      Cookies.set('appRole', 'courier', { expires: 7 });
      return true;
    }

    if (username === 'ocd' && password === 'hani2003') {
      setIsAuthenticated(true);
      setRole('admin');
      Cookies.set('isLoggedIn', 'true', { expires: 7 });
      Cookies.set('appRole', 'admin', { expires: 7 });
      return true;
    }

    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    setRole(null);
    Cookies.remove('isLoggedIn');
    Cookies.remove('appRole');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 
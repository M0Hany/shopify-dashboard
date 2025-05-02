import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import Cookies from 'js-cookie';

interface AuthContextType {
  isAuthenticated: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Check for authentication cookie on initial load
  useEffect(() => {
    const isLoggedIn = Cookies.get('isLoggedIn');
    if (isLoggedIn === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const login = (username: string, password: string): boolean => {
    if (username === 'ocd' && password === 'hani2003') {
      setIsAuthenticated(true);
      // Set cookie to expire in 7 days
      Cookies.set('isLoggedIn', 'true', { expires: 7 });
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    // Remove authentication cookie
    Cookies.remove('isLoggedIn');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
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
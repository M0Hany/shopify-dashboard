import React from 'react';
import { Header } from './Header';
import { useAuth } from '../../contexts/AuthContext';
import { LoginForm } from '../auth/LoginForm';

interface LayoutProps {
  children: React.ReactNode;
  hideHeader?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children, hideHeader = false }) => {
  const { isAuthenticated, logout } = useAuth();

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {!hideHeader && <Header onLogout={logout} />}
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}; 
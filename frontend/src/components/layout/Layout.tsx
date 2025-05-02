import React from 'react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { useAuth } from '../../hooks/useAuth';

interface LayoutProps {
  children: React.ReactNode;
  hideHeader?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children, hideHeader = false }) => {
  const { isAuthenticated, isLoading, user, login, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card>
          <CardContent className="text-center space-y-4">
            <h1 className="text-2xl font-bold">OCD Crochet Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Please log in to access the dashboard
            </p>
            <Button onClick={() => login()}>Log In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gray-50 dark:bg-gray-900">
      {!hideHeader && (
        <header className="w-full bg-white dark:bg-gray-800 shadow-sm">
          <div className="container mx-auto px-4">
            <div className="flex justify-end h-12 items-center">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <img
                    src={user?.picture}
                    alt={user?.name}
                    className="h-8 w-8 rounded-full"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {user?.name}
                  </span>
                </div>
                <Button variant="outline" onClick={() => logout()} size="sm">
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </header>
      )}

      <main className="w-full h-full">
        {children}
      </main>
    </div>
  );
}; 
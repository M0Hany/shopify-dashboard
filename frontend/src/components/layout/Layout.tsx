import React from 'react';
import { Header } from './Header';

interface LayoutProps {
  children: React.ReactNode;
  hideHeader?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children, hideHeader = false }) => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {!hideHeader && <Header />}
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}; 
import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface HeaderProps {
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = () => {
  const { logout } = useAuth();
  
  const handleLogout = () => {
    logout();
    window.location.href = '/shopify-dashboard/';
  };

  return (
    <header className="w-full bg-white shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex justify-between h-14 items-center">
          <h1 className="text-lg font-semibold text-gray-900">
            OCD Crochet Dashboard
          </h1>
          <button
            onClick={handleLogout}
            className="px-4 py-1.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}; 
import React from 'react';

interface HeaderProps {
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onLogout }) => {
  return (
    <header className="w-full bg-white dark:bg-gray-800 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex justify-between h-12 items-center">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            OCD Crochet Dashboard
          </h1>
          <button
            onClick={onLogout}
            className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}; 
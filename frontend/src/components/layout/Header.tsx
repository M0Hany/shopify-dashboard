import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="w-full bg-white dark:bg-gray-800 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex justify-between h-12 items-center">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            OCD Crochet Dashboard
          </h1>
        </div>
      </div>
    </header>
  );
}; 
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface HeaderProps {
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = () => {
  const { logout } = useAuth();
  const location = useLocation();
  
  const handleLogout = () => {
    logout();
    window.location.href = '/shopify-dashboard/';
  };

  const navigation = [
    { name: 'Orders', href: '/orders' },
    { name: 'Finance', href: '/finance' },
    { name: 'WhatsApp', href: '/whatsapp' },
  ];

  return (
    <header className="w-full bg-white shadow-sm py-2">
      <div className="container mx-auto px-4">
        <div className="flex justify-between h-10 items-center">
          <nav className="flex space-x-4">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md ${
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>
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
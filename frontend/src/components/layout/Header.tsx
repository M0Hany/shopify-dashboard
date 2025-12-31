import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';

interface HeaderProps {
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = () => {
  const { logout } = useAuth();
  const location = useLocation();
  
  // Check for unread WhatsApp messages
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['whatsapp-unread-count'],
    queryFn: async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/whatsapp/stats`);
        if (!response.ok) return 0;
        const data = await response.json();
        return data.stats?.unreadMessages || 0;
      } catch {
        return 0;
      }
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
  
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
    <header className="sticky top-0 z-50 w-full bg-white shadow-sm py-2">
      <div className="container mx-auto px-4">
        <div className="flex justify-between h-10 items-center">
          <nav className="flex space-x-4">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              const hasUnread = item.name === 'WhatsApp' && unreadCount > 0;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`relative px-3 py-1.5 text-sm font-medium rounded-md ${
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {item.name}
                  {hasUnread && (
                    <span className="absolute top-0 right-0 w-2 h-2 bg-green-500 rounded-full transform translate-x-1 -translate-y-1"></span>
                  )}
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
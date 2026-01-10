import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { 
  ShoppingBagIcon, 
  CurrencyDollarIcon, 
  ChatBubbleLeftRightIcon 
} from '@heroicons/react/24/outline';

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
    { 
      name: 'Orders', 
      href: '/orders',
      icon: ShoppingBagIcon
    },
    { 
      name: 'Finance', 
      href: '/finance',
      icon: CurrencyDollarIcon
    },
    { 
      name: 'WhatsApp', 
      href: '/whatsapp',
      icon: ChatBubbleLeftRightIcon,
      badge: unreadCount
    },
  ];

  return (
    <>
      {/* Desktop Header - Hidden on mobile */}
      <header className="hidden md:block sticky top-0 z-50 w-full bg-white shadow-sm border-b border-gray-200">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-gray-900">OCD Crochet</h1>
            </div>
            
            <nav className="flex items-center gap-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                const IconComponent = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`relative flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <IconComponent className="w-5 h-5" />
                    <span>{item.name}</span>
                    {item.badge && item.badge > 0 && (
                      <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-green-500 rounded-full">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
            
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
    </>
  );
};
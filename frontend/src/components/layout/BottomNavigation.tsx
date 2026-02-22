import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  ShoppingBagIcon, 
  CurrencyDollarIcon, 
  ChatBubbleLeftRightIcon 
} from '@heroicons/react/24/outline';
import { 
  ShoppingBagIcon as ShoppingBagIconSolid, 
  CurrencyDollarIcon as CurrencyDollarIconSolid, 
  ChatBubbleLeftRightIcon as ChatBubbleLeftRightIconSolid 
} from '@heroicons/react/24/solid';
import { useQuery } from '@tanstack/react-query';

const BottomNavigation: React.FC = () => {
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

  const navigation = [
    { 
      name: 'Orders', 
      href: '/orders',
      icon: ShoppingBagIcon,
      iconSolid: ShoppingBagIconSolid
    },
    { 
      name: 'Finance', 
      href: '/finance',
      icon: CurrencyDollarIcon,
      iconSolid: CurrencyDollarIconSolid
    },
    { 
      name: 'WhatsApp', 
      href: '/whatsapp',
      icon: ChatBubbleLeftRightIcon,
      iconSolid: ChatBubbleLeftRightIconSolid,
      badge: unreadCount
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-800 border-t border-slate-700 shadow-2xl md:hidden backdrop-blur-lg bg-opacity-95">
      <div className="flex justify-around items-center h-16 px-2">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          const IconComponent = isActive ? item.iconSolid : item.icon;
          
          return (
            <Link
              key={item.name}
              to={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full relative transition-all duration-200 ${
                isActive
                  ? 'text-blue-400'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <div className="relative">
                <IconComponent className="w-6 h-6 mx-auto" />
                {item.badge !== undefined && (
                  <span className="absolute -bottom-1 -left-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-green-500 rounded-full shadow-lg ring-2 ring-slate-800">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-1 font-medium transition-colors ${isActive ? 'text-blue-400' : 'text-slate-400'}`}>
                {item.name}
              </span>
              {isActive && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-blue-400 rounded-b-full shadow-lg shadow-blue-400/50" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavigation;


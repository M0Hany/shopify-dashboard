import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LoginForm } from '../auth/LoginForm';
import { Header } from './Header';
import BottomNavigation from './BottomNavigation';

interface LayoutProps {
  children: React.ReactNode;
  hideHeader?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children, hideHeader }) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  useEffect(() => {
    // Set document title
    document.title = 'OCD Crochet Dashboard';
  }, []);

  if (!isAuthenticated) {
    // If user is not logged in and trying to access a restricted route
    if (location.pathname !== '/') {
      return <Navigate to="/" replace />;
    }
    return <LoginForm />;
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {!hideHeader && <Header />}
      <main className={`flex-1 bg-gray-50 ${!hideHeader ? 'pb-16 md:pb-0' : ''}`}>
        {children}
      </main>
      {!hideHeader && <BottomNavigation />}
    </div>
  );
}; 
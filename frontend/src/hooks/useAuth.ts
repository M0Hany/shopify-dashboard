import { useAuth0 } from '@auth0/auth0-react';

export const useAuth = () => {
  const {
    loginWithRedirect,
    logout,
    isAuthenticated,
    isLoading,
    user,
    getAccessTokenSilently,
  } = useAuth0();

  const handleLogin = () => {
    loginWithRedirect();
  };

  const handleLogout = () => {
    logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
  };

  const getToken = async () => {
    try {
      return await getAccessTokenSilently();
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  };

  return {
    isAuthenticated,
    isLoading,
    user,
    login: handleLogin,
    logout: handleLogout,
    getToken,
  };
}; 
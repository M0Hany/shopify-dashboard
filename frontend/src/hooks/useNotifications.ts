import { useEffect, useState } from 'react';

export const useNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  useEffect(() => {
    // Request permission if not already granted or denied
    if (typeof Notification !== 'undefined' && permission === 'default') {
      Notification.requestPermission().then((result) => {
        setPermission(result);
      });
    }
  }, [permission]);

  const showNotification = (
    title: string,
    options?: NotificationOptions
  ): void => {
    if (typeof Notification === 'undefined') {
      console.warn('Notifications are not supported in this browser');
      return;
    }

    if (permission !== 'granted') {
      console.warn('Notification permission not granted');
      return;
    }

    try {
      const notification = new Notification(title, {
        icon: '/favicon.png',
        badge: '/favicon.png',
        ...options,
      });

      // Auto-close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);

      // Handle click to focus the window
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  };

  return { showNotification, permission };
};


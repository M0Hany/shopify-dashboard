import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface WhatsAppConnectionProps {
  onStatusChange?: (status: WhatsAppStatus) => void;
}

interface WhatsAppStatus {
  isReady: boolean;
  queueLength: number;
  isProcessingQueue: boolean;
  isServerless?: boolean;
}

const WhatsAppConnection: React.FC<WhatsAppConnectionProps> = ({ onStatusChange }) => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const queryClient = useQueryClient();

  // Fetch WhatsApp status
  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ['whatsapp-status'],
    queryFn: async () => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/whatsapp/status`);
      if (!response.ok) {
        throw new Error('Failed to fetch WhatsApp status');
      }
      const data = await response.json();
      return data.data as WhatsAppStatus;
    },
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  // Use memoized callback for status updates to prevent infinite loops
  const handleStatusUpdate = useCallback((data: WhatsAppStatus | undefined) => {
    if (data && onStatusChange) {
      onStatusChange({
        isReady: data.isReady,
        queueLength: data.queueLength,
        isProcessingQueue: data.isProcessingQueue,
        isServerless: data.isServerless
      });
    }
  }, [onStatusChange]);

  // Update parent component with status changes
  useEffect(() => {
    handleStatusUpdate(statusData);
  }, [statusData, handleStatusUpdate]);

  // Initialize WhatsApp connection
  const initMutation = useMutation({
    mutationFn: async () => {
      setConnecting(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/whatsapp/init`);
      if (!response.ok) {
        throw new Error('Failed to initialize WhatsApp');
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (data.status === 'qr_needed') {
        setQrCode(data.qr);
      } else if (data.status === 'ready') {
        setQrCode(null);
        queryClient.invalidateQueries({ queryKey: ['whatsapp-status'] });
      }
      setConnecting(false);
    },
    onError: () => {
      setConnecting(false);
    }
  });

  // Disconnect WhatsApp
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/whatsapp/disconnect`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to disconnect WhatsApp');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-status'] });
    }
  });

  // Handle connect button click
  const handleConnect = () => {
    initMutation.mutate();
  };

  // Handle disconnect button click
  const handleDisconnect = () => {
    disconnectMutation.mutate();
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">WhatsApp Connection</h2>
      
      {statusLoading ? (
        <div className="flex justify-center my-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : statusData?.isServerless ? (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span>Status: Serverless Mode</span>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            WhatsApp Web integration is not available in the production environment. 
            When sending messages, a direct WhatsApp link will be used instead.
          </p>
        </div>
      ) : (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-3 h-3 rounded-full ${statusData?.isReady ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>Status: {statusData?.isReady ? 'Connected' : 'Disconnected'}</span>
          </div>
          
          {statusData?.isReady && (
            <div className="text-sm text-gray-600">
              <p>Messages in queue: {statusData.queueLength}</p>
              <p>Processing: {statusData.isProcessingQueue ? 'Yes' : 'No'}</p>
            </div>
          )}
        </div>
      )}
      
      {qrCode && (
        <div className="my-4">
          <p className="mb-2 text-sm">Scan this QR code with WhatsApp:</p>
          <div className="bg-white p-4 inline-block">
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCode)}`} 
              alt="WhatsApp QR Code" 
              className="w-48 h-48"
            />
          </div>
        </div>
      )}
      
      <div className="flex gap-2 mt-4">
        <button
          onClick={handleConnect}
          disabled={connecting || statusData?.isReady}
          className={`px-4 py-2 rounded ${
            connecting || statusData?.isReady 
              ? 'bg-gray-300 text-gray-600 cursor-not-allowed' 
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          {connecting ? 'Connecting...' : 'Connect'}
        </button>
        
        <button
          onClick={handleDisconnect}
          disabled={!statusData?.isReady}
          className={`px-4 py-2 rounded ${
            !statusData?.isReady 
              ? 'bg-gray-300 text-gray-600 cursor-not-allowed' 
              : 'bg-red-500 text-white hover:bg-red-600'
          }`}
        >
          Disconnect
        </button>
      </div>
    </div>
  );
};

export default WhatsAppConnection; 
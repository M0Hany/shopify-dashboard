import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';

interface WhatsAppMessageSenderProps {
  orderId: number;
  customerName: string;
  phone: string;
  className?: string;
}

const WhatsAppMessageSender: React.FC<WhatsAppMessageSenderProps> = ({ 
  orderId, 
  customerName, 
  phone,
  className = ''
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [message, setMessage] = useState('');

  // Format phone number for display
  const displayPhone = phone ? formatPhoneForDisplay(phone) : 'No phone number';

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/whatsapp/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          orderId, 
          phone: formatPhoneForWhatsApp(phone), 
          message 
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to send WhatsApp message');
      }
      return response.json();
    },
    onSuccess: () => {
      alert('Message sent successfully!');
      setMessage('');
      setIsModalOpen(false);
    },
    onError: (error) => {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    }
  });

  // Send confirmation template
  const sendConfirmationMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/whatsapp/send-confirmation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          orderId, 
          phone: formatPhoneForWhatsApp(phone)
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to send confirmation message');
      }
      return response.json();
    },
    onSuccess: () => {
      alert('Confirmation message sent successfully!');
      setIsModalOpen(false);
    },
    onError: (error) => {
      console.error('Error sending confirmation message:', error);
      alert('Failed to send confirmation message. Please try again.');
    }
  });

  // Open directly in WhatsApp Web or Business App
  const openWhatsAppMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/whatsapp/send-via-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          phone: formatPhoneForWhatsApp(phone),
          message
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to generate WhatsApp link');
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Open the link in a new tab
      if (data.data && data.data.whatsappLink) {
        window.open(data.data.whatsappLink, '_blank');
        setMessage('');
        setIsModalOpen(false);
      }
    },
    onError: (error) => {
      console.error('Error generating WhatsApp link:', error);
      alert('Failed to open WhatsApp. Please try again.');
    }
  });

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    sendMessageMutation.mutate(message);
  };

  // Format phone number for WhatsApp API
  function formatPhoneForWhatsApp(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  // Format phone number for display
  function formatPhoneForDisplay(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('20')) {
      return `+${digits.substring(0, 2)} ${digits.substring(2)}`;
    } else if (digits.length === 10 && digits.startsWith('0')) {
      return digits;
    } else {
      return phone;
    }
  }

  return (
    <div className={className}>
      <button
        onClick={() => setIsModalOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        disabled={!phone}
        title={phone ? "Send WhatsApp message" : "No phone number available"}
      >
        <ChatBubbleLeftRightIcon className="w-5 h-5" />
        <span>WhatsApp</span>
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-medium mb-2">Send WhatsApp Message</h3>
            <p className="text-sm text-gray-600 mb-4">
              Message will be sent to {customerName} ({displayPhone})
            </p>
            
            <form onSubmit={handleSubmit}>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full h-32 p-2 border rounded-md mb-4 bg-white"
                placeholder="Enter your WhatsApp message..."
              />
              
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                <button
                  type="button"
                  onClick={() => sendConfirmationMutation.mutate()}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                  disabled={sendConfirmationMutation.isPending}
                >
                  {sendConfirmationMutation.isPending ? 'Sending...' : 'Send Confirmation Message'}
                </button>
                
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openWhatsAppMutation.mutate()}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Open in WhatsApp
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                  >
                    Cancel
                  </button>
                  
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                    disabled={!message.trim() || sendMessageMutation.isPending}
                  >
                    {sendMessageMutation.isPending ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppMessageSender; 
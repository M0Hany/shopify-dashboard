import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ChatBubbleLeftIcon, 
  PaperAirplaneIcon, 
  PhoneIcon,
  UserIcon,
  ClockIcon,
  CheckIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { useSearchParams, useNavigate } from 'react-router-dom';

interface Message {
  id: string;
  message_id: string;
  phone: string;
  from: string;
  to: string;
  type: string;
  text?: {
    body: string;
  };
  timestamp: string;
  status?: 'sent' | 'delivered' | 'read' | 'failed';
  direction?: 'inbound' | 'outbound';
  created_at: string;
  updated_at: string;
}

interface Conversation {
  id: string;
  phone: string;
  lastMessage?: Message;
  unreadCount?: number;
}

const WhatsAppInbox: React.FC = () => {
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showConversations, setShowConversations] = useState(true); // For mobile toggle
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Auto-select conversation from URL parameter
  useEffect(() => {
    const phoneFromUrl = searchParams.get('phone');
    if (phoneFromUrl && !selectedPhone) {
      setSelectedPhone(phoneFromUrl);
      setShowConversations(false); // Hide sidebar on mobile when auto-selecting
    }
  }, [searchParams, selectedPhone]);

  // Fetch all conversations
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery({
    queryKey: ['whatsapp-conversations'],
    queryFn: async () => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/whatsapp/conversations`);
      if (!response.ok) throw new Error('Failed to fetch conversations');
      const data = await response.json();
      return data.conversations || [];
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch messages for selected conversation
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['whatsapp-messages', selectedPhone],
    queryFn: async () => {
      if (!selectedPhone) return [];
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/whatsapp/conversation/${selectedPhone}?limit=100`);
      if (!response.ok) throw new Error('Failed to fetch messages');
      const data = await response.json();
      return data.messages || [];
    },
    enabled: !!selectedPhone,
    refetchInterval: selectedPhone ? 10000 : false, // Refetch every 10 seconds when conversation is selected
  });

  // Mark messages as read when conversation is selected
  const markAsReadMutation = useMutation({
    mutationFn: async (phone: string) => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/whatsapp/mark-read/${phone}`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to mark messages as read');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ phone, message }: { phone: string; message: string }) => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/whatsapp/send-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message }),
      });
      if (!response.ok) throw new Error('Failed to send message');
      return response.json();
    },
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', selectedPhone] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
      toast.success('Message sent successfully');
    },
    onError: () => {
      toast.error('Failed to send message');
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark messages as read when conversation is selected
  useEffect(() => {
    if (selectedPhone) {
      markAsReadMutation.mutate(selectedPhone);
    }
  }, [selectedPhone]);

  // Filter conversations based on search
  const filteredConversations = conversations.filter((conv: Conversation) =>
    conv.phone.includes(searchQuery)
  );

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPhone || !newMessage.trim()) return;
    
    sendMessageMutation.mutate({
      phone: selectedPhone,
      message: newMessage.trim(),
    });
  };

  const formatPhoneNumber = (phone: string) => {
    // Return phone number as stored in database (no formatting)
    return phone;
  };

  const handlePhoneNumberClick = (phone: string) => {
    // Format phone number for search - remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Remove the first digit from the phone number
    const searchPhone = cleaned.length > 1 ? cleaned.substring(1) : cleaned;
    
    // Navigate to orders page with the modified phone number in search
    navigate(`/orders?search=${searchPhone}`);
  };

  const formatTimestamp = (timestamp: string | Date) => {
    try {
      const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
      const now = new Date();
      const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
      
      if (diffInHours < 24) {
        return format(date, 'HH:mm');
      } else if (diffInHours < 48) {
        return 'Yesterday';
      } else {
        return format(date, 'MMM dd');
      }
    } catch {
      return 'Unknown';
    }
  };

  const getMessageStatusIcon = (status?: string) => {
    switch (status) {
      case 'sent':
        return <CheckIcon className="w-3 h-3 text-gray-400" />;
      case 'delivered':
        return <CheckIcon className="w-3 h-3 text-blue-500" />;
      case 'read':
        return <CheckCircleIcon className="w-3 h-3 text-blue-600" />;
      case 'failed':
        return <CheckIcon className="w-3 h-3 text-red-500" />;
      default:
        return <ClockIcon className="w-3 h-3 text-gray-400" />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Conversations Sidebar */}
      <div className={`${showConversations ? 'flex' : 'hidden'} md:flex w-full md:w-80 bg-white border-r border-gray-200 flex-col absolute md:relative z-10 h-full`}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">WhatsApp Inbox</h1>
            {/* Mobile close button */}
            <button
              onClick={() => setShowConversations(false)}
              className="md:hidden p-2 text-gray-500 hover:text-gray-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="mt-3">
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {conversationsLoading ? (
            <div className="p-4 text-center text-gray-500">Loading conversations...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {searchQuery ? 'No conversations found' : 'No conversations yet'}
            </div>
          ) : (
            filteredConversations.map((conversation: Conversation) => (
              <div
                key={conversation.id}
                onClick={() => {
                  setSelectedPhone(conversation.phone);
                  setShowConversations(false); // Hide sidebar on mobile when conversation is selected
                }}
                className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedPhone === conversation.phone ? 'bg-blue-50 border-blue-200' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <PhoneIcon className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">
                        {formatPhoneNumber(conversation.phone)}
                      </p>
                      {conversation.lastMessage && (
                        <p className="text-sm text-gray-500 truncate">
                          {conversation.lastMessage.text?.body || 'Media message'}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    {conversation.lastMessage && (
                      <p className="text-xs text-gray-400">
                        {formatTimestamp(conversation.lastMessage.timestamp)}
                      </p>
                    )}
                    {conversation.unreadCount && conversation.unreadCount > 0 && (
                      <div className="mt-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-xs text-white font-medium">
                          {conversation.unreadCount}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedPhone ? (
          <>
            {/* Chat Header */}
            <div className="p-4 bg-white border-b border-gray-200">
              <div className="flex items-center space-x-3">
                {/* Mobile back button */}
                <button
                  onClick={() => setShowConversations(true)}
                  className="md:hidden p-2 text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <PhoneIcon className="w-5 h-5 text-green-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <button
                    onClick={() => handlePhoneNumberClick(selectedPhone)}
                    className="font-semibold text-gray-900 truncate hover:text-blue-600 hover:underline transition-colors cursor-pointer text-left w-full bg-white"
                    title="Click to find order for this phone number"
                  >
                    {formatPhoneNumber(selectedPhone)}
                  </button>
                  <p className="text-sm text-gray-500">WhatsApp conversation</p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-3 md:space-y-4">
              {messagesLoading ? (
                <div className="text-center text-gray-500">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="text-center text-gray-500">No messages yet</div>
              ) : (
                messages.map((message: Message) => {
                  const isOutgoing = message.direction === 'outbound';
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] md:max-w-xs lg:max-w-md px-3 py-2 md:px-4 md:py-2 rounded-lg ${
                          isOutgoing
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 text-gray-900'
                        }`}
                      >
                        <p className="text-sm break-words">{message.text?.body || 'Media message'}</p>
                        <div className={`flex items-center justify-between mt-1 ${
                          isOutgoing ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          <span className="text-xs">
                            {formatTimestamp(message.timestamp)}
                          </span>
                          {isOutgoing && (
                            <div className="ml-2 flex-shrink-0">
                              {getMessageStatusIcon(message.status)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-2 md:p-4 bg-white border-t border-gray-200">
              <form onSubmit={handleSendMessage} className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm md:text-base"
                  disabled={sendMessageMutation.isPending}
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sendMessageMutation.isPending}
                  className="px-3 py-2 md:px-4 md:py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                  <PaperAirplaneIcon className="w-4 h-4" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center p-4">
              <ChatBubbleLeftIcon className="w-12 h-12 md:w-16 md:h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-base md:text-lg font-medium text-gray-900 mb-2">
                Select a conversation
              </h3>
              <p className="text-sm md:text-base text-gray-500">
                Choose a conversation from the sidebar to start messaging
              </p>
              {/* Mobile show conversations button */}
              <button
                onClick={() => setShowConversations(true)}
                className="md:hidden mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                Show Conversations
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatsAppInbox; 
import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ChatBubbleLeftIcon, 
  PaperAirplaneIcon, 
  PhoneIcon,
  ClockIcon,
  CheckIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Dialog } from '@headlessui/react';

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

interface WhatsAppMessageTemplate {
  id: string;
  key: string;
  name: string;
  body: string;
  created_at: string;
  updated_at: string;
}

const WhatsAppInbox: React.FC = () => {
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showConversations, setShowConversations] = useState(true); // For mobile toggle
  const [conversationFilter, setConversationFilter] = useState<'all' | 'unread'>('all');
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();
  const API = import.meta.env.VITE_API_URL;

  const MESSAGE_INPUT_MIN_HEIGHT = 44;
  const MESSAGE_INPUT_MAX_HEIGHT = 160;
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

  // Always fetch unread conversations separately for accurate badge count
  const { data: unreadConversations = [] } = useQuery({
    queryKey: ['whatsapp-conversations', 'unread'],
    queryFn: async () => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/whatsapp/conversations?limit=10000&unread=true`);
      if (!response.ok) throw new Error('Failed to fetch unread conversations');
      const data = await response.json();
      return data.conversations || [];
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch conversations based on active filter
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery({
    queryKey: ['whatsapp-conversations', conversationFilter],
    queryFn: async () => {
      const unreadParam = conversationFilter === 'unread' ? '&unread=true' : '';
      const limit = conversationFilter === 'unread' ? '10000' : '20';
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/whatsapp/conversations?limit=${limit}${unreadParam}`);
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
      const response = await fetch(`${API}/api/whatsapp/conversation/${selectedPhone}?limit=100`);
      if (!response.ok) throw new Error('Failed to fetch messages');
      const data = await response.json();
      return data.messages || [];
    },
    enabled: !!selectedPhone,
    refetchInterval: selectedPhone ? 10000 : false, // Refetch every 10 seconds when conversation is selected
  });

  // Fetch templates when template dialog is open
  const { data: templates = [] } = useQuery({
    queryKey: ['whatsapp-templates'],
    queryFn: async () => {
      const res = await fetch(`${API}/api/whatsapp/templates`);
      if (!res.ok) return [];
      const json = await res.json();
      return (json.templates || []) as WhatsAppMessageTemplate[];
    },
    enabled: templateDialogOpen,
  });

  // Fetch orders when template dialog is open (to resolve placeholders for selected phone)
  const { data: ordersForPlaceholders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const res = await fetch(`${API}/api/orders`);
      if (!res.ok) return [];
      return (await res.json()) as Array<{
        id: number;
        customer?: { first_name?: string; phone?: string };
        shipping_address?: { phone?: string };
        line_items?: Array<{ title: string; variant_title?: string | null }>;
      }>;
    },
    enabled: templateDialogOpen && !!selectedPhone,
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
    onMutate: async (phone: string) => {
      // Cancel outgoing refetches for all conversation queries
      await queryClient.cancelQueries({ queryKey: ['whatsapp-conversations'] });
      
      // Snapshot previous values for both 'all' and 'unread' filters
      const previousConversationsAll = queryClient.getQueryData<Conversation[]>(['whatsapp-conversations', 'all']);
      const previousConversationsUnread = queryClient.getQueryData<Conversation[]>(['whatsapp-conversations', 'unread']);
      
      // Optimistically update: remove unread badge for both filters
      // Keep conversation in unread tab, just remove the badge (better UX)
      const updateUnreadCount = (old: Conversation[] = []) =>
        old.map((conv: Conversation) =>
          conv.phone === phone ? { ...conv, unreadCount: 0 } : conv
        );
      
      queryClient.setQueryData<Conversation[]>(['whatsapp-conversations', 'all'], updateUnreadCount);
      queryClient.setQueryData<Conversation[]>(['whatsapp-conversations', 'unread'], updateUnreadCount);
      
      return { previousConversationsAll, previousConversationsUnread };
    },
    onError: (_err, _phone, context) => {
      // Rollback on error
      if (context?.previousConversationsAll) {
        queryClient.setQueryData(['whatsapp-conversations', 'all'], context.previousConversationsAll);
      }
      if (context?.previousConversationsUnread) {
        queryClient.setQueryData(['whatsapp-conversations', 'unread'], context.previousConversationsUnread);
      }
    },
    // Remove onSuccess - let refetchInterval handle updates naturally
  });

  // Mark all conversations as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      // Use unreadConversations to mark ALL unread conversations, not just the current view
      const phones = unreadConversations.map((conv: Conversation) => conv.phone);
      
      // Batch requests to avoid overwhelming the server
      // Process in chunks of 10 with a small delay between chunks
      const chunkSize = 10;
      const chunks: string[][] = [];
      for (let i = 0; i < phones.length; i += chunkSize) {
        chunks.push(phones.slice(i, i + chunkSize));
      }
      
      const failed: string[] = [];
      
      // Process each chunk sequentially with a delay
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const promises = chunk.map(phone =>
          fetch(`${import.meta.env.VITE_API_URL}/api/whatsapp/mark-read/${phone}`, {
            method: 'POST',
          })
        );
        
        const results = await Promise.allSettled(promises);
        results.forEach((result, index) => {
          if (result.status === 'rejected' || (result.status === 'fulfilled' && !result.value.ok)) {
            failed.push(chunk[index]);
          }
        });
        
        // Add a small delay between chunks (except for the last one)
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay between chunks
        }
      }
      
      if (failed.length > 0) {
        throw new Error(`Failed to mark ${failed.length} conversation(s) as read`);
      }
      return { success: true };
    },
    onMutate: async () => {
      // Cancel outgoing refetches for all conversation queries
      await queryClient.cancelQueries({ queryKey: ['whatsapp-conversations'] });
      
      // Snapshot previous values for both 'all' and 'unread' filters
      const previousConversationsAll = queryClient.getQueryData<Conversation[]>(['whatsapp-conversations', 'all']);
      const previousConversationsUnread = queryClient.getQueryData<Conversation[]>(['whatsapp-conversations', 'unread']);
      
      // Optimistically update: remove all unread badges for 'all' filter
      queryClient.setQueryData<Conversation[]>(['whatsapp-conversations', 'all'], (old = []) =>
        old.map((conv: Conversation) => ({
          ...conv,
          unreadCount: 0,
        }))
      );
      
      // For 'unread' filter, clear all conversations (since all are now read)
      queryClient.setQueryData<Conversation[]>(['whatsapp-conversations', 'unread'], () => []);
      
      return { previousConversationsAll, previousConversationsUnread };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previousConversationsAll) {
        queryClient.setQueryData(['whatsapp-conversations', 'all'], context.previousConversationsAll);
      }
      if (context?.previousConversationsUnread) {
        queryClient.setQueryData(['whatsapp-conversations', 'unread'], context.previousConversationsUnread);
      }
      toast.error('Failed to mark all conversations as read');
    },
    onSuccess: () => {
      toast.success('All conversations marked as read');
      // Remove invalidation - let refetchInterval handle updates naturally
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
    onMutate: async ({ phone, message }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['whatsapp-messages', phone] });
      await queryClient.cancelQueries({ queryKey: ['whatsapp-conversations'] });
      
      // Snapshot previous values
      const previousMessages = queryClient.getQueryData<Message[]>(['whatsapp-messages', phone]);
      const previousConversationsAll = queryClient.getQueryData<Conversation[]>(['whatsapp-conversations', 'all']);
      const previousConversationsUnread = queryClient.getQueryData<Conversation[]>(['whatsapp-conversations', 'unread']);
      
      // Create optimistic message
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        message_id: `temp-${Date.now()}`,
        phone,
        from: phone,
        to: phone,
        type: 'text',
        text: { body: message },
        timestamp: new Date().toISOString(),
        status: 'sent',
        direction: 'outbound',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      // Optimistically add message to chat
      queryClient.setQueryData<Message[]>(['whatsapp-messages', phone], (old = []) => [
        ...old,
        optimisticMessage,
      ]);
      
      // Optimistically update conversation last message for both filters
      const updateConversation = (old: Conversation[] = []) =>
        old.map((conv: Conversation) =>
          conv.phone === phone
            ? {
                ...conv,
                lastMessage: optimisticMessage,
                unreadCount: 0, // Outbound messages are always read
              }
            : conv
        );
      
      queryClient.setQueryData<Conversation[]>(['whatsapp-conversations', 'all'], updateConversation);
      queryClient.setQueryData<Conversation[]>(['whatsapp-conversations', 'unread'], updateConversation);
      
      // Clear input immediately
      setNewMessage('');
      
      return { previousMessages, previousConversationsAll, previousConversationsUnread };
    },
    onError: (_err, { phone }, context) => {
      // Rollback on error
      if (context?.previousMessages) {
        queryClient.setQueryData(['whatsapp-messages', phone], context.previousMessages);
      }
      if (context?.previousConversationsAll) {
        queryClient.setQueryData(['whatsapp-conversations', 'all'], context.previousConversationsAll);
      }
      if (context?.previousConversationsUnread) {
        queryClient.setQueryData(['whatsapp-conversations', 'unread'], context.previousConversationsUnread);
      }
      toast.error('Failed to send message');
    },
    onSuccess: () => {
      toast.success('Message sent successfully');
      // Remove invalidation - let refetchInterval handle updates naturally
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

  // Filter conversations based on search (unread filter is handled by backend)
  const filteredConversations = conversations.filter((conv: Conversation) => {
    // Search filter
    return conv.phone.includes(searchQuery);
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPhone || !newMessage.trim()) return;
    
    sendMessageMutation.mutate({
      phone: selectedPhone,
      message: newMessage.trim(),
    });
  };

  // Normalize phone to digits for matching (e.g. 201234567890)
  const normalizePhoneForMatch = (phone: string): string => {
    const digits = (phone || '').replace(/\D/g, '');
    if (digits.startsWith('201')) return digits.slice(0, 12);
    if (digits.startsWith('20')) return '201' + digits.slice(2, 11);
    if (digits.startsWith('01')) return '2' + digits;
    if (digits.startsWith('1')) return '20' + digits;
    return digits ? '201' + digits.slice(-9) : '';
  };

  // Get placeholder values from orders for the current chat phone
  const getPlaceholderData = (): { customer_first_name: string; items_list: string } => {
    const normalized = selectedPhone ? normalizePhoneForMatch(selectedPhone) : '';
    const order = (ordersForPlaceholders as Array<{
      customer?: { first_name?: string; phone?: string };
      shipping_address?: { phone?: string };
      line_items?: Array<{ title: string; variant_title?: string | null }>;
    }>).find((o: any) => {
      const p = (o.customer?.phone || o.shipping_address?.phone || '').replace(/\D/g, '');
      const orderNorm = normalizePhoneForMatch(p || '');
      return orderNorm && normalized && (orderNorm === normalized || orderNorm.endsWith(normalized.slice(-9)) || normalized.endsWith(orderNorm.slice(-9)));
    });
    const customerFirstName = order?.customer?.first_name?.trim() || 'Customer';
    const itemsList = order?.line_items?.length
      ? order.line_items.map((item: any) => `- ${item.title}${item.variant_title ? ` (${item.variant_title})` : ''}`).join('\n')
      : '—';
    return { customer_first_name: customerFirstName, items_list: itemsList };
  };

  // Apply template body with placeholder replacement
  const applyTemplate = (body: string): string => {
    const { customer_first_name, items_list } = getPlaceholderData();
    return body
      .replace(/\{\{customer_first_name\}\}/g, customer_first_name)
      .replace(/\{\{items_list\}\}/g, items_list);
  };

  const handleSelectTemplate = (t: WhatsAppMessageTemplate) => {
    const filled = applyTemplate(t.body);
    setNewMessage((prev) => (prev ? prev + '\n\n' + filled : filled));
    setTemplateDialogOpen(false);
  };

  // Auto-resize message textarea up to max height, then scroll
  const resizeMessageInput = () => {
    const el = messageInputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const newHeight = Math.min(Math.max(el.scrollHeight, MESSAGE_INPUT_MIN_HEIGHT), MESSAGE_INPUT_MAX_HEIGHT);
    el.style.height = `${newHeight}px`;
    el.style.overflowY = el.scrollHeight > MESSAGE_INPUT_MAX_HEIGHT ? 'auto' : 'hidden';
  };

  useEffect(() => {
    resizeMessageInput();
  }, [newMessage]);

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

  const formatDateDivider = (timestamp: string | Date) => {
    try {
      const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
      
      if (isToday(date)) {
        return 'Today';
      } else if (isYesterday(date)) {
        return 'Yesterday';
      } else {
        return format(date, 'MMMM d, yyyy');
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

  // Height = viewport minus nav: mobile has bottom nav (4rem), desktop has header (3.5rem)
  return (
    <div className="flex h-[calc(100vh-4rem)] md:h-[calc(100vh-3.5rem)] min-h-0 bg-gray-50 overflow-hidden">
      {/* Conversations Sidebar */}
      <div className={`${showConversations ? 'flex' : 'hidden'} md:flex w-full md:w-80 bg-white border-r border-gray-200 flex-col absolute md:relative z-10 h-full min-h-0 shadow-lg`}>
        {/* Header with WhatsApp green accent */}
        <div className="bg-gradient-to-r from-[#25D366] to-[#20BA5A] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ChatBubbleLeftIcon className="w-6 h-6 text-white" />
              <h1 className="text-xl font-semibold text-white">Chats</h1>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/whatsapp/templates"
                className="px-3 py-1.5 text-xs font-medium text-white bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                title="Message templates"
              >
                Templates
              </Link>
              {/* Read All button */}
              {unreadConversations.length > 0 && (
                <button
                  onClick={() => markAllAsReadMutation.mutate()}
                  disabled={markAllAsReadMutation.isPending}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-white/20 hover:bg-white/30 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
                  title="Mark all conversations as read"
                >
                  {markAllAsReadMutation.isPending ? 'Marking...' : 'Read All'}
                </button>
              )}
            </div>
          </div>
          
          {/* Enhanced Search */}
          <div className="relative mb-3">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/70" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-white/20 backdrop-blur-sm border-0 rounded-full text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50 focus:bg-white/30 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/70 hover:text-white transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Filter Chips */}
          <div className="flex gap-2">
            <button
              onClick={() => setConversationFilter('all')}
              className={`flex-1 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                conversationFilter === 'all'
                  ? 'bg-white text-[#25D366] shadow-md'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setConversationFilter('unread')}
              className={`flex-1 px-4 py-2 rounded-full text-sm font-medium transition-all relative ${
                conversationFilter === 'unread'
                  ? 'bg-white text-[#25D366] shadow-md'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              Unread
              {unreadConversations.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
                  {unreadConversations.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-white">
          {conversationsLoading ? (
            // Loading Skeletons
            <div className="p-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="animate-pulse p-3 mx-2 mb-1">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gray-200 rounded-full flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                      <div className="h-3 bg-gray-200 rounded w-full" />
                    </div>
                    <div className="w-12 h-3 bg-gray-200 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredConversations.length === 0 ? (
            // Enhanced Empty State
            <div className="flex flex-col items-center justify-center h-full p-8">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <ChatBubbleLeftIcon className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchQuery ? 'No conversations found' : 'No conversations yet'}
              </h3>
              <p className="text-sm text-gray-500 text-center max-w-xs">
                {searchQuery 
                  ? 'Try adjusting your search terms'
                  : 'Start a conversation to see messages here'}
              </p>
            </div>
          ) : (
            filteredConversations.map((conversation: Conversation) => (
              <div
                key={conversation.id || conversation.phone}
                onClick={() => {
                  setSelectedPhone(conversation.phone);
                  setShowConversations(false); // Hide sidebar on mobile when conversation is selected
                }}
                className={`group p-3 mx-2 my-1 rounded-lg cursor-pointer transition-all duration-200 ${
                  selectedPhone === conversation.phone 
                    ? 'bg-[#E5E7EB] shadow-sm' 
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    {/* Enhanced Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 bg-gradient-to-br from-[#25D366] to-[#20BA5A] rounded-full flex items-center justify-center shadow-sm">
                        <PhoneIcon className="w-6 h-6 text-white" />
                      </div>
                      {/* Unread indicator on avatar */}
                      {(conversation.unreadCount ?? 0) > 0 && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-2 border-white rounded-full animate-pulse" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className={`font-semibold truncate ${
                          (conversation.unreadCount ?? 0) > 0 ? 'text-gray-900' : 'text-gray-700'
                        }`}>
                          {formatPhoneNumber(conversation.phone)}
                        </p>
                        {conversation.lastMessage && (
                          <p className="text-xs text-gray-400 ml-2 flex-shrink-0">
                            {formatTimestamp(conversation.lastMessage.timestamp)}
                          </p>
                        )}
                      </div>
                      {conversation.lastMessage && (
                        <div className="flex items-center justify-between">
                          <p className={`text-sm truncate ${
                            (conversation.unreadCount ?? 0) > 0 
                              ? 'text-gray-900 font-medium' 
                              : 'text-gray-500'
                          }`}>
                            {conversation.lastMessage.text?.body || 'Media message'}
                          </p>
                          {(conversation.unreadCount ?? 0) > 0 && (
                            <div className="ml-2 min-w-[20px] h-5 bg-[#25D366] rounded-full flex items-center justify-center px-2 flex-shrink-0">
                              <span className="text-xs text-white font-semibold">
                                {conversation.unreadCount}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
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
            {/* Enhanced Chat Header */}
            <div className="bg-gradient-to-r from-[#25D366] to-[#20BA5A] p-4 shadow-md">
              <div className="flex items-center space-x-3">
                {/* Mobile back button */}
                <button
                  onClick={() => setShowConversations(true)}
                  className="md:hidden p-2 text-black hover:text-gray-800 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border-2 border-white/30">
                  <PhoneIcon className="w-5 h-5 text-white" />
                </div>
                <span
                  onClick={() => handlePhoneNumberClick(selectedPhone)}
                  className="font-semibold text-white truncate hover:text-white/90 transition-colors cursor-pointer"
                  title="Click to find order for this phone number"
                >
                  {formatPhoneNumber(selectedPhone)}
                </span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-[#EFEAE2] space-y-1" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23d4d0c7' fill-opacity='0.4'%3E%3Cpath d='M0 0h40v40H0z'/%3E%3C/g%3E%3C/svg%3E")`,
            }}>
              {messagesLoading ? (
                // Loading Skeletons for Messages
                <div className="space-y-4">
                  <div className="flex justify-start">
                    <div className="animate-pulse max-w-[75%] bg-gray-200 rounded-2xl rounded-tl-sm px-4 py-3">
                      <div className="h-4 bg-gray-300 rounded w-3/4 mb-2" />
                      <div className="h-3 bg-gray-300 rounded w-1/2" />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="animate-pulse max-w-[75%] bg-gray-300 rounded-2xl rounded-tr-sm px-4 py-3">
                      <div className="h-4 bg-gray-400 rounded w-2/3 mb-2" />
                      <div className="h-3 bg-gray-400 rounded w-1/3" />
                    </div>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                // Enhanced Empty State for Messages
                <div className="flex flex-col items-center justify-center h-full">
                  <div className="w-16 h-16 bg-white/50 rounded-full flex items-center justify-center mb-3">
                    <ChatBubbleLeftIcon className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-500">No messages yet</p>
                  <p className="text-xs text-gray-400 mt-1">Start the conversation</p>
                </div>
              ) : (
                messages.map((message: Message, index: number) => {
                  const isOutgoing = message.direction === 'outbound';
                  const prevMessage = index > 0 ? messages[index - 1] : null;
                  const isGrouped = prevMessage && 
                    prevMessage.direction === message.direction &&
                    (new Date(message.timestamp).getTime() - new Date(prevMessage.timestamp).getTime()) < 300000; // 5 minutes
                  
                  // Check if we need a date divider
                  const messageDate = new Date(message.timestamp);
                  const prevMessageDate = prevMessage ? new Date(prevMessage.timestamp) : null;
                  const needsDateDivider = !prevMessageDate || !isSameDay(messageDate, prevMessageDate);
                  
                  return (
                    <React.Fragment key={message.id}>
                      {needsDateDivider && (
                        <div className="flex justify-center my-4">
                          <div className="px-3 py-1.5 bg-white/80 backdrop-blur-sm rounded-full shadow-sm border border-gray-200/50">
                            <span className="text-xs text-gray-600 font-medium">
                              {formatDateDivider(message.timestamp)}
                            </span>
                          </div>
                        </div>
                      )}
                      <div
                        className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'} ${isGrouped ? 'mt-0.5' : 'mt-2'}`}
                      >
                        <div className="relative max-w-[75%] md:max-w-xs lg:max-w-md">
                          <div
                            className={`px-3 py-2 rounded-2xl shadow-sm ${
                              isOutgoing
                                ? 'bg-[#DCF8C6] text-gray-900 rounded-tr-sm'
                                : 'bg-white text-gray-900 rounded-tl-sm'
                            }`}
                          >
                            <p className="text-sm break-words leading-relaxed">{message.text?.body || 'Media message'}</p>
                            <div className={`flex items-center justify-end gap-1 mt-1 ${
                              isOutgoing ? 'text-gray-600' : 'text-gray-500'
                            }`}>
                              <span className="text-xs">
                                {formatTimestamp(message.timestamp)}
                              </span>
                              {isOutgoing && (
                                <div className="ml-1 flex-shrink-0">
                                  {getMessageStatusIcon(message.status)}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Enhanced Message Input */}
            <div className="p-4 bg-white border-t border-gray-200">
              <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={() => setTemplateDialogOpen(true)}
                  className="flex-shrink-0 p-3 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-[#25D366] transition-all"
                  title="Insert template"
                >
                  <DocumentTextIcon className="w-5 h-5" />
                </button>
                <div className="flex-1 min-w-0 flex flex-col">
                  <textarea
                    ref={messageInputRef}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (newMessage.trim()) {
                          sendMessageMutation.mutate({ phone: selectedPhone!, message: newMessage.trim() });
                        }
                      }
                    }}
                    placeholder="Type a message..."
                    rows={1}
                    className="w-full px-4 py-3 bg-gray-100 border-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:bg-white transition-all text-sm md:text-base resize-none overflow-y-auto"
                    disabled={sendMessageMutation.isPending}
                    style={{ minHeight: MESSAGE_INPUT_MIN_HEIGHT, maxHeight: MESSAGE_INPUT_MAX_HEIGHT }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sendMessageMutation.isPending}
                  className="flex-shrink-0 p-3 bg-[#25D366] text-white rounded-full hover:bg-[#20BA5A] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg disabled:shadow-none"
                >
                  <PaperAirplaneIcon className="w-5 h-5" />
                </button>
              </form>
            </div>

            {/* Template picker dialog */}
            <Dialog open={templateDialogOpen} onClose={() => setTemplateDialogOpen(false)} className="relative z-50">
              <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
              <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="mx-auto w-full max-w-md rounded-lg bg-white shadow-xl border border-gray-200 max-h-[80vh] flex flex-col relative">
                  <button
                    type="button"
                    onClick={() => setTemplateDialogOpen(false)}
                    className="absolute top-3 right-3 p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg z-10"
                    aria-label="Close"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                  <div className="overflow-y-auto p-4 pt-12 space-y-2 flex-1">
                    {templates.length === 0 ? (
                      <p className="text-sm text-gray-500">No templates. Add them in Message templates.</p>
                    ) : (
                      ([...templates]
                        .sort((a, b) => (a.key === 'order_ready' ? -1 : b.key === 'order_ready' ? 1 : 0))
                        .map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => handleSelectTemplate(t)}
                            className={`w-full text-left p-3 rounded-lg border transition-colors ${
                              t.key === 'order_ready'
                                ? 'bg-amber-50/90 border-amber-200 hover:border-amber-300 hover:bg-amber-100/90'
                                : 'border-gray-200 hover:border-[#25D366] hover:bg-green-50/50'
                            }`}
                          >
                            <span className="font-medium text-gray-900 block">{t.name}</span>
                            <span className="text-sm text-gray-600 line-clamp-2 mt-1 block">
                              {t.body.split(/\r?\n/).slice(0, 2).join(' ').slice(0, 80)}…
                            </span>
                          </button>
                        ))
                      )
                    )}
                  </div>
                </Dialog.Panel>
              </div>
            </Dialog>
          </>
        ) : (
          <div className="flex-1 min-h-0 flex items-center justify-center">
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
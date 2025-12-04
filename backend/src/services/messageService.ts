import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

export interface IMessage {
  id: string;
  message_id: string;
  phone: string;
  from: string;
  to: string;
  type: string;
  text?: { body: string };
  timestamp: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  direction: 'inbound' | 'outbound';
  order_number?: string;
  created_at: string;
  updated_at: string;
}

export class MessageService {
  // Store a new message
  static async storeMessage(messageData: {
    message_id: string;
    phone: string;
    from: string;
    to: string;
    type: string;
    text?: { body: string };
    timestamp: Date;
    direction: 'inbound' | 'outbound';
    order_number?: string;
  }): Promise<IMessage> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .insert({
          message_id: messageData.message_id,
          phone: messageData.phone,
          from: messageData.from,
          to: messageData.to,
          type: messageData.type,
          text: messageData.text,
          timestamp: messageData.timestamp.toISOString(),
          status: 'sent',
          direction: messageData.direction,
          order_number: messageData.order_number
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info('Message stored successfully', {
        message_id: messageData.message_id,
        phone: messageData.phone,
        direction: messageData.direction
      });

      return data;
    } catch (error) {
      logger.error('Error storing message', {
        error,
        message_id: messageData.message_id,
        phone: messageData.phone
      });
      throw error;
    }
  }

  // Update message status
  static async updateMessageStatus(message_id: string, status: 'sent' | 'delivered' | 'read' | 'failed'): Promise<void> {
    try {
      const { error } = await supabase
        .from('whatsapp_messages')
        .update({ status })
        .eq('message_id', message_id);

      if (error) {
        throw error;
      }

      logger.info('Message status updated', {
        message_id,
        status
      });
    } catch (error) {
      logger.error('Error updating message status', {
        error,
        message_id,
        status
      });
      throw error;
    }
  }

  // Get conversation history for a phone number
  static async getConversationHistory(phone: string, limit: number = 50): Promise<IMessage[]> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('phone', phone)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      logger.info('Conversation history retrieved', {
        phone,
        messageCount: data?.length || 0
      });

      return (data || []).reverse(); // Return in chronological order
    } catch (error) {
      logger.error('Error retrieving conversation history', {
        error,
        phone
      });
      throw error;
    }
  }

  // Get all conversations (unique phone numbers with recent messages)
  static async getAllConversations(limit: number = 20): Promise<Array<{
    phone: string;
    lastMessage: IMessage;
    unreadCount: number;
  }>> {
    try {
      // Get the most recent message for each phone number
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) {
        throw error;
      }

      // Group by phone number and get the most recent message
      const conversationsMap = new Map<string, { lastMessage: IMessage; unreadCount: number }>();
      
      data?.forEach(message => {
        if (!conversationsMap.has(message.phone)) {
          conversationsMap.set(message.phone, {
            lastMessage: message,
            unreadCount: 0
          });
        }
        
        // Count unread inbound messages
        if (message.direction === 'inbound' && message.status !== 'read') {
          const conversation = conversationsMap.get(message.phone);
          if (conversation) {
            conversation.unreadCount++;
          }
        }
      });

      const conversations = Array.from(conversationsMap.entries())
        .map(([phone, data]) => ({
          phone,
          lastMessage: data.lastMessage,
          unreadCount: data.unreadCount
        }))
        .sort((a, b) => new Date(b.lastMessage.timestamp).getTime() - new Date(a.lastMessage.timestamp).getTime())
        .slice(0, limit);

      logger.info('Conversations retrieved', {
        conversationCount: conversations.length
      });

      return conversations;
    } catch (error) {
      logger.error('Error retrieving conversations', {
        error
      });
      throw error;
    }
  }

  // Mark messages as read for a phone number
  static async markMessagesAsRead(phone: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('whatsapp_messages')
        .update({ status: 'read' })
        .eq('phone', phone)
        .eq('direction', 'inbound')
        .neq('status', 'read');

      if (error) {
        throw error;
      }

      logger.info('Messages marked as read', {
        phone
      });
    } catch (error) {
      logger.error('Error marking messages as read', {
        error,
        phone
      });
      throw error;
    }
  }

  // Get message statistics
  static async getMessageStats(): Promise<{
    totalMessages: number;
    todayMessages: number;
    unreadMessages: number;
    conversationsCount: number;
  }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get total messages
      const { count: totalMessages, error: totalError } = await supabase
        .from('whatsapp_messages')
        .select('*', { count: 'exact', head: true });

      if (totalError) throw totalError;

      // Get today's messages
      const { count: todayMessages, error: todayError } = await supabase
        .from('whatsapp_messages')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', today.toISOString());

      if (todayError) throw todayError;

      // Get unread messages
      // Check only the latest 20 inbound messages for performance
      // Count messages where status is not 'read' (including null/undefined statuses)
      const { data: latestInboundMessages, error: unreadError } = await supabase
        .from('whatsapp_messages')
        .select('status')
        .eq('direction', 'inbound')
        .order('timestamp', { ascending: false })
        .limit(20);
      
      if (unreadError) throw unreadError;
      
      // Count messages where status is null, undefined, or not 'read'
      const unreadMessages = latestInboundMessages?.filter(msg => 
        !msg.status || msg.status !== 'read'
      ).length || 0;

      if (unreadError) throw unreadError;

      // Get unique conversations count
      const { data: conversations, error: conversationsError } = await supabase
        .from('whatsapp_messages')
        .select('phone')
        .order('phone');

      if (conversationsError) throw conversationsError;

      const uniquePhones = new Set(conversations?.map(msg => msg.phone) || []);

      return {
        totalMessages: totalMessages || 0,
        todayMessages: todayMessages || 0,
        unreadMessages: unreadMessages || 0,
        conversationsCount: uniquePhones.size
      };
    } catch (error) {
      logger.error('Error getting message statistics', {
        error
      });
      throw error;
    }
  }
} 
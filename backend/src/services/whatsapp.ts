import axios, { AxiosError } from 'axios';
import { logger } from '../utils/logger';
import { WhatsAppMonitor } from './monitoring/WhatsAppMonitor';
import { MessageService } from './messageService';

export class WhatsAppService {
  private apiUrl: string;
  private accessToken: string;
  private phoneNumberId: string;
  private tokenLastRotated: Date;
  private static readonly TOKEN_ROTATION_DAYS = 90;

  constructor() {
    this.apiUrl = 'https://graph.facebook.com/v18.0';
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    this.tokenLastRotated = new Date();

    // Check token age daily
    setInterval(() => this.checkTokenAge(), 24 * 60 * 60 * 1000);
  }

  private checkTokenAge(): void {
    const daysSinceRotation = Math.floor(
      (new Date().getTime() - this.tokenLastRotated.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceRotation >= WhatsAppService.TOKEN_ROTATION_DAYS) {
      logger.warn('WhatsApp token rotation recommended', {
        daysSinceLastRotation: daysSinceRotation,
        recommendedRotationDays: WhatsAppService.TOKEN_ROTATION_DAYS
      });
    }
  }

  private formatPhoneNumber(phone: string): string {
    // Remove all non-numeric characters
    let formatted = phone.replace(/\D/g, '');
    
    // Handle different formats
    if (formatted.startsWith('201')) {
      // Already has country code
      formatted = formatted.substring(0, 12); // Limit to 12 digits
    } else if (formatted.startsWith('20')) {
      // Has country code without mobile prefix
      formatted = '201' + formatted.substring(2);
      formatted = formatted.substring(0, 12); // Limit to 12 digits
    } else if (formatted.startsWith('01')) {
      // Has mobile prefix with leading 0
      formatted = '2' + formatted; // Add country code while keeping the 1
      formatted = formatted.substring(0, 12); // Limit to 12 digits
    } else if (formatted.startsWith('1')) {
      // Has mobile prefix without leading 0
      formatted = '20' + formatted;
      formatted = formatted.substring(0, 12); // Limit to 12 digits
    } else {
      // Assume it's a local number without any prefixes
      formatted = '201' + formatted;
      formatted = formatted.substring(0, 12); // Limit to 12 digits
    }

    // Log the formatting transformation
    logger.info('Phone number formatting', {
      original: phone,
      formatted: formatted,
      timestamp: new Date().toISOString()
    });

    return formatted;
  }

  private async sendTemplateMessage(
    phone: string,
    template: string,
    parameters: { type: string; text: string }[] = [],
    orderNumber?: string
  ): Promise<string | null> {
    try {
      const originalPhone = phone;
      const formattedPhone = this.formatPhoneNumber(phone);
      
      logger.info('Phone number formatting', {
        originalPhone,
        formattedPhone,
        template,
        timestamp: new Date().toISOString()
      });
      
      // Check rate limits before sending
      const canSend = await WhatsAppMonitor.trackMessage(
        `${template}-${Date.now()}`,
        formattedPhone
      );

      if (!canSend) {
        throw new Error('Rate limit exceeded');
      }

      logger.info(`Sending WhatsApp ${template} message`, {
        phone: formattedPhone,
        template,
        parameters
      });

      const response = await axios.post(
        `${this.apiUrl}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: formattedPhone,
          type: 'template',
          template: {
            name: template,
            language: {
              code: 'en'
            },
            components: [
              {
                type: 'body',
                parameters: parameters.map((param, index) => ({
                  type: param.type,
                  text: param.text
                }))
              }
            ]
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const messageId = response.data?.messages?.[0]?.id;
      if (messageId) {
        WhatsAppMonitor.updateMessageStatus(messageId, 'sent');
        
        // Store message in database
        await MessageService.storeMessage({
          message_id: messageId,
          phone: formattedPhone,
          from: this.phoneNumberId,
          to: formattedPhone,
          type: 'template',
          text: { body: JSON.stringify({ template, parameters }) },
          timestamp: new Date(),
          direction: 'outbound',
          order_number: orderNumber
        });
      }

      logger.info(`WhatsApp ${template} message sent successfully`, {
        response: response.data
      });
      return messageId;
    } catch (error) {
      // Log the full error response for debugging
      if (error instanceof AxiosError && error.response?.data) {
        console.log('=== WHATSAPP API ERROR DETAILS ===');
        console.log('Status:', error.response.status);
        console.log('Status Text:', error.response.statusText);
        console.log('Error Data:', JSON.stringify(error.response.data, null, 2));
        console.log('URL:', error.config?.url);
        console.log('Method:', error.config?.method);
        console.log('==================================');
        
        logger.error('WhatsApp API Error Response:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers
        });
      } else {
        console.log('=== NON-AXIOS ERROR ===');
        console.log('Error:', error);
        console.log('Error type:', typeof error);
        console.log('=======================');
      }
      
      logger.error(`Error sending WhatsApp ${template} message:`, {
        error: error instanceof Error ? error.message : error,
        phone,
        template,
        parameters
      });
      throw new Error(`Failed to send WhatsApp ${template} message`);
    }
  }

  // Order Creation - Lead Time Confirmation
  async sendLeadTimeConfirmation(
    phone: string,
    customerName: string,
    orderNumber: string,
    leadTime: string
  ): Promise<void> {
    await this.sendTemplateMessage(phone, 'lead_time_confirmation', [
      { type: 'text', text: customerName },
      { type: 'text', text: orderNumber },
      { type: 'text', text: leadTime }
    ], orderNumber);
  }

  // Production Confirmation
  async sendProductionConfirmed(
    phone: string,
    orderNumber: string,
    estimatedCompletion: string
  ): Promise<void> {
    await this.sendTemplateMessage(phone, 'production_confirmed', [
      { type: 'text', text: orderNumber },
      { type: 'text', text: estimatedCompletion }
    ], orderNumber);
  }

  // Ready to Ship - Delivery Scheduling
  async sendDeliveryScheduling(
    phone: string,
    orderNumber: string,
    availableSlots: string
  ): Promise<void> {
    await this.sendTemplateMessage(phone, 'delivery_scheduling', [
      { type: 'text', text: orderNumber },
      { type: 'text', text: availableSlots }
    ], orderNumber);
  }

  // Shipped - Pickup Notification
  async sendPickupNotification(
    phone: string,
    orderNumber: string,
    trackingNumber: string
  ): Promise<void> {
    await this.sendTemplateMessage(phone, 'pickup_notification', [
      { type: 'text', text: orderNumber },
      { type: 'text', text: trackingNumber }
    ], orderNumber);
  }

  // Fulfilled - Delivery Confirmation
  async sendDeliveryConfirmation(
    phone: string,
    orderNumber: string,
    customerName: string
  ): Promise<void> {
    await this.sendTemplateMessage(phone, 'delivery_confirmation', [
      { type: 'text', text: customerName },
      { type: 'text', text: orderNumber }
    ], orderNumber);
  }

  // Cancelled
  async sendOrderCancelled(
    phone: string,
    orderNumber: string,
    reason: string
  ): Promise<void> {
    await this.sendTemplateMessage(phone, 'order_cancelled', [
      { type: 'text', text: orderNumber },
      { type: 'text', text: reason }
    ], orderNumber);
  }

  // Test message for development
  async sendTestMessage(phone: string): Promise<void> {
    await this.sendTemplateMessage(phone, 'hello_world');
  }

  // Method to get current monitoring stats
  async getMessageStats() {
    return WhatsAppMonitor.getDailyStats();
  }

  // Order Creation - Order Confirmation
  async sendOrderConfirmation(
    phone: string,
    orderNumber: string,
    customerName: string
  ): Promise<void> {
    await this.sendTemplateMessage(phone, 'order_confirmed', [
      { type: 'text', text: customerName },
      { type: 'text', text: orderNumber }
    ], orderNumber);
  }

  // Order Ready Notification
  async sendOrderReady(phone: string, orderNumber: string): Promise<string | null> {
    try {
      const formattedPhone = this.formatPhoneNumber(phone);
      
      // Check rate limits before sending
      const canSend = await WhatsAppMonitor.trackMessage(
        `order_ready-${Date.now()}`,
        formattedPhone
      );

      if (!canSend) {
        throw new Error('Rate limit exceeded');
      }

      logger.info('Sending WhatsApp order_ready message', {
        phone: formattedPhone,
        orderNumber
      });

      // Use the pre-approved template with order number parameter
      const messageId = await this.sendTemplateMessage(formattedPhone, 'order_ready', [
        { type: 'text', text: orderNumber }
      ], orderNumber);

      logger.info('WhatsApp order_ready message sent successfully');
      return messageId;
    } catch (error) {
      // Log the full error response for debugging
      if (error instanceof AxiosError && error.response?.data) {
        logger.error('WhatsApp API Error Response:', {
          status: error.response.status,
          data: error.response.data,
          timestamp: new Date().toISOString()
        });
      }
      
      logger.error('Error sending WhatsApp order_ready message:', {
        error,
        phone,
        orderNumber,
        timestamp: new Date().toISOString()
      });
      throw new Error('Failed to send WhatsApp order_ready message');
    }
  }

  // Order Received Notification
  async sendOrderReceived(phone: string, orderNumber: string, customerName: string): Promise<void> {
    // The order_received template has no variables, so we don't pass any parameters
    await this.sendTemplateMessage(phone, 'order_received', [], orderNumber);
  }

  // Send text message (for inbox functionality)
  async sendTextMessage(phone: string, message: string): Promise<string | null> {
    try {
      const formattedPhone = this.formatPhoneNumber(phone);
      
      // Check rate limits before sending
      const canSend = await WhatsAppMonitor.trackMessage(
        `text-${Date.now()}`,
        formattedPhone
      );

      if (!canSend) {
        throw new Error('Rate limit exceeded');
      }

      logger.info('Sending WhatsApp text message', {
        phone: formattedPhone,
        message: message.substring(0, 100) + (message.length > 100 ? '...' : '')
      });

      const response = await axios.post(
        `${this.apiUrl}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: formattedPhone,
          type: 'text',
          text: {
            body: message
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const messageId = response.data?.messages?.[0]?.id;
      if (messageId) {
        WhatsAppMonitor.updateMessageStatus(messageId, 'sent');
        
        // Store message in database
        await MessageService.storeMessage({
          message_id: messageId,
          phone: formattedPhone,
          from: this.phoneNumberId,
          to: formattedPhone,
          type: 'text',
          text: { body: message },
          timestamp: new Date(),
          direction: 'outbound'
        });
      }

      logger.info('WhatsApp text message sent successfully', {
        response: response.data
      });
      return messageId;
    } catch (error) {
      if (error instanceof AxiosError && error.response?.data) {
        logger.error('WhatsApp API Error Response:', {
          status: error.response.status,
          data: error.response.data,
          timestamp: new Date().toISOString()
        });
      }
      
      logger.error('Error sending WhatsApp text message:', {
        error,
        phone,
        timestamp: new Date().toISOString()
      });
      throw new Error('Failed to send WhatsApp text message');
    }
  }

  // Get conversation history (for inbox functionality)
  async getConversationHistory(phone: string, limit: number = 50): Promise<any[]> {
    try {
      const formattedPhone = this.formatPhoneNumber(phone);
      
      logger.info('Fetching WhatsApp conversation history', {
        phone: formattedPhone,
        limit
      });

      // Get messages from database instead of API
      const messages = await MessageService.getConversationHistory(formattedPhone, limit);

      logger.info('WhatsApp conversation history fetched successfully', {
        messageCount: messages.length
      });

      return messages;
    } catch (error) {
      logger.error('Error fetching WhatsApp conversation history:', {
        error,
        phone,
        timestamp: new Date().toISOString()
      });
      throw new Error('Failed to fetch WhatsApp conversation history');
    }
  }

  // Get all conversations (list of phone numbers with recent messages)
  async getAllConversations(limit: number = 20, unreadOnly: boolean = false): Promise<any[]> {
    try {
      logger.info('Fetching all WhatsApp conversations', {
        limit,
        unreadOnly
      });

      // Get conversations from database instead of API
      const conversations = await MessageService.getAllConversations(limit, unreadOnly);

      logger.info('WhatsApp conversations fetched successfully', {
        conversationCount: conversations.length
      });

      return conversations;
    } catch (error) {
      logger.error('Error fetching WhatsApp conversations:', {
        error,
        timestamp: new Date().toISOString()
      });
      throw new Error('Failed to fetch WhatsApp conversations');
    }
  }
} 
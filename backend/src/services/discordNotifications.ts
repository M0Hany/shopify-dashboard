import axios from 'axios';
import { logger } from '../utils/logger';

interface OrderStatusNotification {
  orderId: number;
  orderName: string;
  customerName: string;
  previousStatus: string;
  newStatus: string;
  updatedBy?: string;
}

interface BulkStatusNotification {
  orderCount: number;
  previousStatus: string;
  newStatus: string;
  orderNames: string[];
  updatedBy?: string;
}

interface WhatsAppNotification {
  phone: string;
  customerName?: string;
  messageText: string;
  messageType: string;
  orderNumber?: string;
  timestamp: Date;
}

export class DiscordNotificationService {
  private webhookUrl: string | null;
  private whatsappWebhookUrl: string | null;
  private botToken: string | null;
  private whatsappChannelId: string | null;

  constructor() {
    this.webhookUrl = process.env.DISCORD_WEBHOOK_URL || null;
    this.whatsappWebhookUrl = process.env.DISCORD_WHATSAPP_WEBHOOK_URL || null;
    this.botToken = process.env.DISCORD_BOT_TOKEN || null;
    this.whatsappChannelId = process.env.DISCORD_WHATSAPP_CHANNEL_ID || null;
    
    if (!this.webhookUrl) {
      logger.warn('Discord webhook URL not configured. Order status notifications will be disabled.');
    }
    
    if (!this.whatsappWebhookUrl && !this.botToken) {
      logger.warn('Discord WhatsApp webhook URL or bot token not configured. WhatsApp notifications will be disabled.');
    }
  }

  /**
   * Map internal status values to user-friendly display names
   */
  private getStatusDisplayName(status: string): string {
    const statusMap: Record<string, string> = {
      'pending': 'Pending',
      'order_ready': 'Order Ready',
      'order-ready': 'Order Ready',
      'customer_confirmed': 'Customer Confirmed',
      'confirmed': 'Customer Confirmed',
      'ready_to_ship': 'Ready to Ship',
      'ready-to-ship': 'Ready to Ship',
      'shipped': 'Shipped',
      'fulfilled': 'Fulfilled',
      'cancelled': 'Cancelled',
      'on_hold': 'On Hold',
      'on-hold': 'On Hold',
      'paid': 'Paid'
    };

    return statusMap[status.toLowerCase()] || status;
  }

  /**
   * Check if status change should trigger a notification
   */
  private shouldNotify(previousStatus: string, newStatus: string): boolean {
    const trackedStatuses = ['pending', 'order_ready', 'order-ready', 'customer_confirmed', 'confirmed', 'ready_to_ship', 'ready-to-ship', 'on_hold', 'on-hold', 'cancelled'];
    
    const prev = previousStatus.toLowerCase().trim();
    const next = newStatus.toLowerCase().trim();
    
    // Only notify for transitions between tracked statuses
    return trackedStatuses.some(s => s.toLowerCase() === prev) && 
           trackedStatuses.some(s => s.toLowerCase() === next) &&
           prev !== next;
  }

  /**
   * Send a notification for a single order status change
   */
  async notifyOrderStatusChange(notification: OrderStatusNotification): Promise<void> {
    if (!this.webhookUrl) {
      return; // Silently skip if webhook not configured
    }

    const { orderId, orderName, customerName, previousStatus, newStatus, updatedBy } = notification;

    // Check if this status change should trigger a notification
    if (!this.shouldNotify(previousStatus, newStatus)) {
      return;
    }

    try {
      const prevDisplay = this.getStatusDisplayName(previousStatus);
      const newDisplay = this.getStatusDisplayName(newStatus);

      // Determine color based on status
      const getStatusColor = (status: string): number => {
        const statusLower = status.toLowerCase().trim();
        if (statusLower === 'order_ready' || statusLower === 'order-ready') return 0xFFA500; // Orange
        if (statusLower === 'customer_confirmed' || statusLower === 'confirmed') return 0x00FF00; // Green
        if (statusLower === 'ready_to_ship' || statusLower === 'ready-to-ship') return 0x0099FF; // Blue
        if (statusLower === 'on_hold' || statusLower === 'on-hold') return 0xFFFF00; // Yellow
        if (statusLower === 'cancelled') return 0xFF0000; // Red
        return 0x808080; // Gray
      };

      // Customize description based on update source
      const description = updatedBy && updatedBy.toLowerCase().includes('automated')
        ? updatedBy.toLowerCase().includes('system')
          ? `Order status automatically updated by system`
          : `Order status updated via automated WhatsApp confirmation`
        : `Order status has been changed`;

      const embed = {
        title: '📦 Order Status Updated',
        description,
        color: getStatusColor(newStatus),
        fields: [
          {
            name: 'Order',
            value: `**${orderName}**`,
            inline: true
          },
          {
            name: 'Customer',
            value: customerName || 'N/A',
            inline: true
          },
          {
            name: 'Status Change',
            value: `\`${prevDisplay}\` → \`${newDisplay}\``,
            inline: false
          }
        ],
        timestamp: new Date().toISOString(),
        footer: {
          text: `Order ID: ${orderId}`
        }
      };

      if (updatedBy) {
        embed.fields.push({
          name: 'Updated By',
          value: updatedBy,
          inline: false
        });
      }

      await axios.post(this.webhookUrl, {
        embeds: [embed]
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      logger.info('Discord notification sent for order status change', {
        orderId,
        orderName,
        previousStatus,
        newStatus
      });
    } catch (error) {
      logger.error('Failed to send Discord notification', {
        error,
        orderId,
        orderName
      });
      // Don't throw - notifications shouldn't break the main flow
    }
  }

  /**
   * Send a notification for bulk order status changes
   */
  async notifyBulkStatusChange(notification: BulkStatusNotification): Promise<void> {
    if (!this.webhookUrl) {
      return; // Silently skip if webhook not configured
    }

    const { orderCount, previousStatus, newStatus, orderNames, updatedBy } = notification;

    // Check if this status change should trigger a notification
    if (!this.shouldNotify(previousStatus, newStatus)) {
      return;
    }

      try {
        const prevDisplay = this.getStatusDisplayName(previousStatus);
        const newDisplay = this.getStatusDisplayName(newStatus);

        // Determine color based on status
        const getStatusColor = (status: string): number => {
          const statusLower = status.toLowerCase().trim();
          if (statusLower === 'order_ready' || statusLower === 'order-ready') return 0xFFA500; // Orange
          if (statusLower === 'customer_confirmed' || statusLower === 'confirmed') return 0x00FF00; // Green
          if (statusLower === 'ready_to_ship' || statusLower === 'ready-to-ship') return 0x0099FF; // Blue
          if (statusLower === 'on_hold' || statusLower === 'on-hold') return 0xFFFF00; // Yellow
          if (statusLower === 'cancelled') return 0xFF0000; // Red
          return 0x808080; // Gray
        };

        // Format order names list (show first 10, then "... and X more")
      const maxDisplay = 10;
      const displayNames = orderNames.slice(0, maxDisplay);
      const remaining = orderNames.length - maxDisplay;
      let orderList = displayNames.join(', ');
      if (remaining > 0) {
        orderList += `\n... and ${remaining} more`;
      }

      const embed = {
        title: '📦 Bulk Order Status Update',
        description: `${orderCount} order${orderCount > 1 ? 's' : ''} status updated`,
        color: getStatusColor(newStatus),
        fields: [
          {
            name: 'Orders Affected',
            value: `${orderCount} order${orderCount > 1 ? 's' : ''}`,
            inline: true
          },
          {
            name: 'Status Change',
            value: `\`${prevDisplay}\` → \`${newDisplay}\``,
            inline: true
          },
          {
            name: 'Order List',
            value: orderList.length > 1024 ? orderList.substring(0, 1020) + '...' : orderList,
            inline: false
          }
        ],
        timestamp: new Date().toISOString(),
        footer: {
          text: `Bulk Update`
        }
      };

      if (updatedBy) {
        embed.fields.push({
          name: 'Updated By',
          value: updatedBy,
          inline: false
        });
      }

      await axios.post(this.webhookUrl, {
        embeds: [embed]
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      logger.info('Discord notification sent for bulk status change', {
        orderCount,
        previousStatus,
        newStatus
      });
    } catch (error) {
      logger.error('Failed to send Discord bulk notification', {
        error,
        orderCount
      });
      // Don't throw - notifications shouldn't break the main flow
    }
  }

  /**
   * Send a notification for an incoming WhatsApp message
   */
  async notifyWhatsAppMessage(notification: WhatsAppNotification): Promise<void> {
    if (!this.whatsappWebhookUrl) {
      return; // Silently skip if webhook not configured
    }

    const { phone, customerName, messageText, messageType, orderNumber, timestamp } = notification;

    try {
      // Truncate message if too long (Discord field limit is 1024 characters per field)
      const truncateMessage = (text: string, maxLength: number = 1000): string => {
        if (!text) return 'No text content';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
      };

      // Format phone number for display
      const formatPhoneForDisplay = (phone: string): string => {
        // Remove country code if present and format
        let formatted = phone.replace(/\D/g, '');
        if (formatted.startsWith('20')) {
          formatted = '0' + formatted.substring(2);
        }
        return formatted || phone;
      };

      // Format order number with # symbol
      const formatOrderNumber = (orderNum: string | undefined): string => {
        if (!orderNum) return 'Not found';
        // Remove any existing # and add it
        const cleaned = orderNum.replace(/^#/, '').trim();
        return `#${cleaned}`;
      };

      // Format message text for notification (this appears in push notifications)
      // The content field is what appears in notification center/phone - this is the most important
      const notificationContent = truncateMessage(messageText, 2000);
      
      // Get frontend URL for deep links
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const chatUrl = `${frontendUrl}/#/whatsapp?phone=${encodeURIComponent(phone)}`;
      
      // Build embed with message, customer, and order number
      const embed = {
        color: 0x25D366, // WhatsApp green color
        fields: [
          {
            name: 'Message',
            value: truncateMessage(messageText, 1000),
            inline: false
          },
          {
            name: 'Customer',
            value: customerName 
              ? `**${customerName}**\n\`${formatPhoneForDisplay(phone)}\``
              : `\`${formatPhoneForDisplay(phone)}\``,
            inline: true
          },
          {
            name: 'Order Number',
            value: formatOrderNumber(orderNumber),
            inline: true
          }
        ],
        timestamp: timestamp.toISOString()
      };

      // Add action buttons
      // Note: Discord webhooks don't support interactive components (only URL buttons)
      // If bot token is available, use bot API. Otherwise, only use URL button
      const openChatButton: any = {
        type: 2, // BUTTON
        style: 5, // LINK (URL button - works with webhooks)
        label: '💬 Open Chat',
        url: chatUrl
      };

      const quickReplyButton: any = {
        type: 2, // BUTTON
        style: 1, // PRIMARY (blue button)
        label: '⚡ Quick Reply',
        custom_id: `quick_reply:${phone}`
      };

      const viewOrderButton: any = {
        type: 2, // BUTTON
        style: 2, // SECONDARY (gray button)
        label: '📋 View Order',
        custom_id: orderNumber ? `view_order:${orderNumber}` : `view_order_by_phone:${phone}`,
        disabled: !orderNumber && !phone // Disable if we don't have order number or phone
      };

      // Build components array based on available method
      // Discord allows max 5 buttons per row, so we can fit all 3 in one row
      const components: any[] = [
        {
          type: 1, // ACTION_ROW
          components: this.botToken && this.whatsappChannelId
            ? [openChatButton, quickReplyButton, viewOrderButton] // All three buttons if using bot
            : [openChatButton] // Only URL button if using webhook
        }
      ];

      // If bot token is available, use bot API to send message with buttons
      if (this.botToken && this.whatsappChannelId) {
        try {
          const response = await axios.post(
            `https://discord.com/api/v10/channels/${this.whatsappChannelId}/messages`,
            {
              content: notificationContent, // This shows in notification center/phone
              embeds: [embed],
              components: components
            },
            {
              headers: {
                'Authorization': `Bot ${this.botToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          logger.info('Discord WhatsApp notification sent via bot', {
            phone,
            messageType,
            messageId: response.data?.id
          });
          return;
        } catch (botError: any) {
          logger.error('Failed to send via bot, falling back to webhook', {
            error: botError?.response?.data || botError?.message || botError,
            status: botError?.response?.status,
            phone,
            hasBotToken: !!this.botToken,
            hasChannelId: !!this.whatsappChannelId
          });
          // Fall through to webhook method
        }
      }

      // Fallback to webhook
      // Note: Webhooks support URL buttons (style 5) but NOT interactive buttons
      if (this.whatsappWebhookUrl) {
        // Try with URL button first
        const webhookComponents = [
          {
            type: 1, // ACTION_ROW
            components: [
              {
                type: 2, // BUTTON
                style: 5, // LINK (URL button - should work with webhooks)
                label: '💬 Open Chat',
                url: chatUrl
              }
            ]
          }
        ];

        try {
          await axios.post(this.whatsappWebhookUrl, {
            content: notificationContent, // This shows in notification center/phone
            embeds: [embed],
            components: webhookComponents
          }, {
            headers: {
              'Content-Type': 'application/json'
            }
          });
          logger.info('Discord WhatsApp notification sent via webhook', {
            phone,
            messageType,
            hasComponents: true
          });
        } catch (webhookError: any) {
          // If components fail, try without them
          logger.warn('Webhook with components failed, trying without buttons', {
            error: webhookError?.response?.data || webhookError?.message,
            phone
          });
          
          await axios.post(this.whatsappWebhookUrl, {
            content: notificationContent,
            embeds: [embed]
            // No components - some webhooks don't support them
          }, {
            headers: {
              'Content-Type': 'application/json'
            }
          });
          logger.info('Discord WhatsApp notification sent via webhook (without buttons)', {
            phone,
            messageType
          });
        }
      }

      logger.info('Discord WhatsApp notification sent', {
        phone,
        messageType
      });
    } catch (error) {
      logger.error('Failed to send Discord WhatsApp notification', {
        error,
        phone,
        messageType
      });
      // Don't throw - notifications shouldn't break the main flow
    }
  }
}

// Export singleton instance
export const discordNotificationService = new DiscordNotificationService();


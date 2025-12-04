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

  constructor() {
    this.webhookUrl = process.env.DISCORD_WEBHOOK_URL || null;
    this.whatsappWebhookUrl = process.env.DISCORD_WHATSAPP_WEBHOOK_URL || null;
    
    if (!this.webhookUrl) {
      logger.warn('Discord webhook URL not configured. Order status notifications will be disabled.');
    }
    
    if (!this.whatsappWebhookUrl) {
      logger.warn('Discord WhatsApp webhook URL not configured. WhatsApp notifications will be disabled.');
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
      'paid': 'Paid'
    };

    return statusMap[status.toLowerCase()] || status;
  }

  /**
   * Check if status change should trigger a notification
   */
  private shouldNotify(previousStatus: string, newStatus: string): boolean {
    const trackedStatuses = ['pending', 'order_ready', 'order-ready', 'customer_confirmed', 'confirmed', 'ready_to_ship', 'ready-to-ship'];
    
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
        return 0x808080; // Gray
      };

      const embed = {
        title: '📦 Order Status Updated',
        description: `Order status has been changed`,
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
      // Format phone number for display
      const formatPhoneForDisplay = (phone: string): string => {
        // Remove country code if present and format
        let formatted = phone.replace(/\D/g, '');
        if (formatted.startsWith('20')) {
          formatted = '0' + formatted.substring(2);
        }
        return formatted || phone;
      };

      // Truncate message if too long (Discord field limit is 1024 characters)
      const truncateMessage = (text: string, maxLength: number = 500): string => {
        if (!text) return 'No text content';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
      };

      // Get message type display name
      const getMessageTypeDisplay = (type: string): string => {
        const typeMap: Record<string, string> = {
          'text': '📝 Text',
          'image': '🖼️ Image',
          'video': '🎥 Video',
          'audio': '🎵 Audio',
          'document': '📄 Document',
          'location': '📍 Location',
          'contacts': '👤 Contacts',
          'button': '🔘 Button',
          'interactive': '💬 Interactive'
        };
        return typeMap[type.toLowerCase()] || `📨 ${type}`;
      };

      // Format order number with # symbol
      const formatOrderNumber = (orderNum: string | undefined): string => {
        if (!orderNum) return '';
        // Remove any existing # and add it
        const cleaned = orderNum.replace(/^#/, '').trim();
        return `#${cleaned}`;
      };

      // Build title with customer name and order number
      let title = '💬 New WhatsApp Message';
      if (customerName && orderNumber) {
        title = `💬 Message from ${customerName} - ${formatOrderNumber(orderNumber)}`;
      } else if (customerName) {
        title = `💬 Message from ${customerName}`;
      } else if (orderNumber) {
        title = `💬 New Message - ${formatOrderNumber(orderNumber)}`;
      }

      const embed = {
        title,
        description: customerName && orderNumber 
          ? `Customer: **${customerName}** | Order: **${formatOrderNumber(orderNumber)}**`
          : customerName 
            ? `Customer: **${customerName}**`
            : orderNumber
              ? `Order: **${formatOrderNumber(orderNumber)}**`
              : 'Received a new message from a customer',
        color: 0x25D366, // WhatsApp green color
        fields: [
          {
            name: 'Customer',
            value: customerName 
              ? `**${customerName}**\n\`${formatPhoneForDisplay(phone)}\``
              : `\`${formatPhoneForDisplay(phone)}\``,
            inline: true
          },
          {
            name: 'Order Number',
            value: orderNumber ? `**${formatOrderNumber(orderNumber)}**` : 'Not found',
            inline: true
          },
          {
            name: 'Message Type',
            value: getMessageTypeDisplay(messageType),
            inline: true
          },
          {
            name: 'Message',
            value: truncateMessage(messageText),
            inline: false
          }
        ],
        timestamp: timestamp.toISOString(),
        footer: {
          text: `Phone: ${formatPhoneForDisplay(phone)}`
        }
      };

      await axios.post(this.whatsappWebhookUrl, {
        embeds: [embed]
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      logger.info('Discord WhatsApp notification sent', {
        phone,
        messageType,
        hasOrderNumber: !!orderNumber
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


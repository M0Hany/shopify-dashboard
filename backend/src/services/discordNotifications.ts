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

export class DiscordNotificationService {
  private webhookUrl: string | null;

  constructor() {
    this.webhookUrl = process.env.DISCORD_WEBHOOK_URL || null;
    
    if (!this.webhookUrl) {
      logger.warn('Discord webhook URL not configured. Notifications will be disabled.');
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
}

// Export singleton instance
export const discordNotificationService = new DiscordNotificationService();


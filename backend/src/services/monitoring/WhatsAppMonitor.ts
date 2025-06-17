import { logger } from '../../utils/logger';

interface MessageStatus {
  messageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: Date;
  error?: string;
}

export class WhatsAppMonitor {
  private static messageStatuses: Map<string, MessageStatus> = new Map();
  private static dailyMessageCount: Map<string, number> = new Map();
  private static readonly DAILY_LIMIT = 1000; // WhatsApp's initial daily limit
  private static readonly RECIPIENT_DAILY_LIMIT = 250; // Limit per recipient per day

  // Reset counters at midnight
  static {
    setInterval(() => {
      WhatsAppMonitor.dailyMessageCount.clear();
      logger.info('WhatsApp daily message counters reset');
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  static async trackMessage(messageId: string, recipientPhone: string): Promise<boolean> {
    try {
      // Check daily total limit
      const totalDaily = Array.from(this.dailyMessageCount.values()).reduce((a, b) => a + b, 0);
      if (totalDaily >= this.DAILY_LIMIT) {
        logger.warn('Daily message limit reached', { totalDaily });
        return false;
      }

      // Check recipient daily limit
      const recipientCount = this.dailyMessageCount.get(recipientPhone) || 0;
      if (recipientCount >= this.RECIPIENT_DAILY_LIMIT) {
        logger.warn('Recipient daily limit reached', { recipientPhone, recipientCount });
        return false;
      }

      // Update counters
      this.dailyMessageCount.set(
        recipientPhone, 
        (this.dailyMessageCount.get(recipientPhone) || 0) + 1
      );

      // Initialize message status
      this.messageStatuses.set(messageId, {
        messageId,
        status: 'sent',
        timestamp: new Date()
      });

      logger.info('Message tracked successfully', {
        messageId,
        recipientPhone,
        dailyCount: this.dailyMessageCount.get(recipientPhone)
      });

      return true;
    } catch (error) {
      logger.error('Error tracking message', { error, messageId, recipientPhone });
      return false;
    }
  }

  static updateMessageStatus(
    messageId: string, 
    status: 'sent' | 'delivered' | 'read' | 'failed',
    error?: string
  ): void {
    try {
      const currentStatus = this.messageStatuses.get(messageId);
      if (!currentStatus) {
        logger.warn('Attempting to update unknown message status', { messageId, status });
        return;
      }

      this.messageStatuses.set(messageId, {
        ...currentStatus,
        status,
        error,
        timestamp: new Date()
      });

      logger.info('Message status updated', { messageId, status, error });

      // Log failed messages for immediate attention
      if (status === 'failed') {
        logger.error('Message delivery failed', { messageId, error });
      }
    } catch (error) {
      logger.error('Error updating message status', { error, messageId, status });
    }
  }

  static getMessageStatus(messageId: string): MessageStatus | undefined {
    return this.messageStatuses.get(messageId);
  }

  static getDailyStats(): {
    totalMessages: number;
    failedMessages: number;
    recipientCounts: { [phone: string]: number };
  } {
    const failedMessages = Array.from(this.messageStatuses.values())
      .filter(status => status.status === 'failed').length;

    return {
      totalMessages: Array.from(this.dailyMessageCount.values())
        .reduce((a, b) => a + b, 0),
      failedMessages,
      recipientCounts: Object.fromEntries(this.dailyMessageCount)
    };
  }
} 
import { reviewMessageQueue } from '../jobs/queue';
import { logger } from '../utils/logger';
import { buildTemplateMessageByKey } from '../utils/templateMessage';
import { whatsappWebService } from './whatsappWeb.service';
import { ShopifyService } from './shopify';

const DEFAULT_REVIEW_BODY = `Hi {{customer_first_name}}✨
Thank you for your order {{order_number}}! We hope you love it.
We'd really appreciate your feedback 🤍`;

function parseTags(tags: string | string[] | undefined | null): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map((t) => t.trim()).filter(Boolean);
  return tags.split(',').map((t) => t.trim()).filter(Boolean);
}

export function tagsIncludeFulfilled(tags: string | string[] | undefined | null): boolean {
  return parseTags(tags).some((t) => t.trim().toLowerCase() === 'fulfilled');
}

export function wasNewlyFulfilled(
  tagsBefore: string | string[] | undefined | null,
  tagsAfter: string | string[] | undefined | null
): boolean {
  return !tagsIncludeFulfilled(tagsBefore) && tagsIncludeFulfilled(tagsAfter);
}

function bulkDelayMs(bulkIndex?: number): number {
  if (bulkIndex === undefined || bulkIndex === null) return 0;
  const step = Number(process.env.FULFILLED_REVIEW_BULK_DELAY_MS);
  const interval = Number.isFinite(step) && step > 0 ? step : 60_000;
  return bulkIndex * interval;
}

export class FulfilledReviewMessagingService {
  private static instance: FulfilledReviewMessagingService;
  private shopifyService = new ShopifyService();

  static getInstance(): FulfilledReviewMessagingService {
    if (!FulfilledReviewMessagingService.instance) {
      FulfilledReviewMessagingService.instance = new FulfilledReviewMessagingService();
    }
    return FulfilledReviewMessagingService.instance;
  }

  async buildReviewMessage(customerName: string, orderNumber: string): Promise<string> {
    const firstName = customerName?.trim() || 'Customer';
    return buildTemplateMessageByKey(
      'review',
      { customer_first_name: firstName, order_number: orderNumber },
      DEFAULT_REVIEW_BODY
    );
  }

  async sendReviewMessage(data: {
    phone: string;
    customerName: string;
    orderNumber: string;
    orderId?: string;
  }): Promise<void> {
    if (!whatsappWebService.isEnabled()) {
      logger.warn('Review WhatsApp skipped — WhatsApp Web disabled', {
        orderNumber: data.orderNumber
      });
      return;
    }

    whatsappWebService.ensureStarted();
    const message = await this.buildReviewMessage(data.customerName, data.orderNumber);
    await whatsappWebService.sendTextMessage(data.phone, message, data.orderNumber);
    logger.info('Fulfilled review WhatsApp sent', {
      orderNumber: data.orderNumber,
      orderId: data.orderId
    });
  }

  /** Queue (or send immediately) review message when order becomes fulfilled. */
  async scheduleReviewForOrder(params: {
    orderId: number;
    bulkIndex?: number;
  }): Promise<void> {
    try {
      const order = await this.shopifyService.getOrder(params.orderId);
      if (!order) {
        logger.warn('Review WhatsApp skipped — order not found', { orderId: params.orderId });
        return;
      }

      const phone = order.shipping_address?.phone || order.customer?.phone;
      if (!phone?.trim()) {
        logger.warn('Review WhatsApp skipped — no phone', {
          orderId: params.orderId,
          orderName: order.name
        });
        return;
      }

      const payload = {
        phone: phone.trim(),
        customerName: order.customer?.first_name || 'Customer',
        orderNumber: order.name,
        orderId: String(params.orderId)
      };

      const delay = bulkDelayMs(params.bulkIndex);

      if (delay === 0) {
        await this.sendReviewMessage(payload);
        return;
      }

      await reviewMessageQueue.add('send-review', payload, {
        jobId: `review-${params.orderId}-${params.bulkIndex}-${Date.now()}`,
        delay,
        attempts: 2,
        backoff: { type: 'exponential', delay: 30_000 }
      });

      logger.info('Fulfilled review WhatsApp queued', {
        orderId: params.orderId,
        orderName: order.name,
        delayMs: delay,
        bulkIndex: params.bulkIndex
      });
    } catch (error) {
      logger.error('Failed to schedule fulfilled review WhatsApp', {
        orderId: params.orderId,
        error
      });
    }
  }

  async scheduleIfNewlyFulfilled(params: {
    orderId: number;
    tagsBefore: string | string[] | undefined | null;
    tagsAfter: string | string[] | undefined | null;
    bulkIndex?: number;
  }): Promise<void> {
    if (!wasNewlyFulfilled(params.tagsBefore, params.tagsAfter)) return;
    await this.scheduleReviewForOrder({
      orderId: params.orderId,
      bulkIndex: params.bulkIndex
    });
  }
}

export const fulfilledReviewMessaging = FulfilledReviewMessagingService.getInstance();

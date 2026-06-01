import { sendOrderConfirmationMessage } from './orderConfirmationMessaging';
import { ShopifyService } from './shopify';
import { logger } from '../utils/logger';
import { ShopifyOrder } from './shopify';
import { orderConfirmationQueue } from '../jobs/queue';

const CONFIRMATION_SENT_TAG = 'confirmation_sent';
const CONFIRMATION_SCHEDULED_TAG = 'confirmation_scheduled';

const SKIP_CONFIRMATION_TAGS = [
  'confirmed',
  'ready_to_ship',
  'shipped',
  'fulfilled',
  'paid',
  'cancelled',
  CONFIRMATION_SENT_TAG,
  CONFIRMATION_SCHEDULED_TAG
];

export class OrderConfirmationService {
  private static instance: OrderConfirmationService;
  private shopifyService: ShopifyService;

  private constructor() {
    this.shopifyService = new ShopifyService();
  }

  private parseOrderTags(order: ShopifyOrder | { tags?: string | string[] }): string[] {
    const tags = order.tags;
    if (Array.isArray(tags)) return tags.map((t) => t.trim()).filter(Boolean);
    if (typeof tags === 'string') return tags.split(',').map((t) => t.trim()).filter(Boolean);
    return [];
  }

  private hasTag(tags: string[], name: string): boolean {
    const target = name.trim().toLowerCase();
    return tags.some((t) => t.trim().toLowerCase() === target);
  }

  private withTag(tags: string[], name: string): string[] {
    if (this.hasTag(tags, name)) return tags;
    return [...tags, name];
  }

  private withoutTag(tags: string[], name: string): string[] {
    const target = name.trim().toLowerCase();
    return tags.filter((t) => t.trim().toLowerCase() !== target);
  }

  private shouldSkipConfirmation(tags: string[]): boolean {
    return tags.some((tag) =>
      SKIP_CONFIRMATION_TAGS.includes(tag.trim().toLowerCase())
    );
  }

  public static getInstance(): OrderConfirmationService {
    if (!OrderConfirmationService.instance) {
      OrderConfirmationService.instance = new OrderConfirmationService();
    }
    return OrderConfirmationService.instance;
  }

  public async handleNewOrder(order: ShopifyOrder): Promise<void> {
    try {
      const tags = this.parseOrderTags(order);

      if (this.shouldSkipConfirmation(tags)) {
        logger.info('Order confirmation skipped — already sent or scheduled', {
          orderId: order.id,
          orderName: order.name,
          tags
        });
        return;
      }

      // Get phone number from shipping address
      const phone = order.shipping_address?.phone;
      
      if (!phone) {
        logger.error('No phone number found in shipping address', {
          orderId: order.id,
          orderName: order.name
        });
        return;
      }

      // Default 1h delay; set ORDER_CONFIRMATION_DELAY_MS=0 for instant send (testing)
      const defaultDelayMs = 60 * 60 * 1000;
      const parsed = Number(process.env.ORDER_CONFIRMATION_DELAY_MS);
      const delay = Number.isFinite(parsed) ? Math.max(0, parsed) : defaultDelayMs;

      const jobPayload = {
        phone,
        orderNumber: order.name,
        customerName: order.customer.first_name,
        orderId: order.id.toString()
      };

      if (delay === 0) {
        await this.sendDelayedConfirmation(jobPayload);
        logger.info('Order confirmation sent immediately (ORDER_CONFIRMATION_DELAY_MS=0)', {
          orderId: order.id,
          orderName: order.name,
          phone
        });
        return;
      }

      await orderConfirmationQueue.add('send-order-confirmation', jobPayload, {
        jobId: `order-confirmation-${order.id}`,
        delay,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 60000
        }
      });

      const scheduledTags = this.withTag(tags, CONFIRMATION_SCHEDULED_TAG);
      await this.shopifyService.updateOrderTags(order.id.toString(), scheduledTags);

      logger.info('Order confirmation message scheduled', {
        orderId: order.id,
        orderName: order.name,
        phone,
        delayMs: delay,
        scheduledAt: new Date(Date.now() + delay).toISOString()
      });
    } catch (error) {
      logger.error('Error sending order confirmation message', {
        error,
        orderId: order.id,
        orderName: order.name
      });
      throw error;
    }
  }

  /** Orders eligible for first confirmation (same filter as scheduler). */
  public async getPendingConfirmationOrders(): Promise<ShopifyOrder[]> {
    return this.shopifyService.getOrders({
      excluded_tags:
        'confirmed,ready_to_ship,shipped,fulfilled,paid,cancelled,confirmation_sent,confirmation_scheduled'
    });
  }

  /** Remove scheduled marker after a failed queue job so the order can be retried later. */
  public async clearConfirmationScheduled(orderId: string): Promise<void> {
    const id = parseInt(orderId, 10);
    if (isNaN(id)) return;
    const order = await this.shopifyService.getOrder(id);
    if (!order) return;
    const tags = this.parseOrderTags(order);
    if (!this.hasTag(tags, CONFIRMATION_SCHEDULED_TAG)) return;
    await this.shopifyService.updateOrderTags(
      orderId,
      this.withoutTag(tags, CONFIRMATION_SCHEDULED_TAG)
    );
  }

  public async checkPendingOrders(): Promise<void> {
    try {
      logger.info('Checking for pending orders without confirmation');
      
      // Get all orders without the specified tags
      const orders = await this.getPendingConfirmationOrders();

      logger.info(`Found ${orders.length} pending orders without confirmation`);

      // Process each order
      for (const order of orders) {
        await this.handleNewOrder(order);
      }

      logger.info('Completed pending orders check');
    } catch (error) {
      logger.error('Error checking pending orders:', error);
      throw error;
    }
  }

  // Send delayed confirmation message (called by queue processor)
  public async sendDelayedConfirmation(data: {
    phone: string;
    orderNumber: string;
    customerName: string;
    orderId: string;
  }): Promise<void> {
    try {
      // Check if order still exists and doesn't have confirmation_sent tag
      const orderId = parseInt(data.orderId, 10);
      if (isNaN(orderId)) {
        logger.error('Invalid order ID when trying to send delayed confirmation', {
          orderId: data.orderId,
          orderNumber: data.orderNumber
        });
        return;
      }
      const order = await this.shopifyService.getOrder(orderId);
      
      if (!order) {
        logger.warn('Order not found when trying to send delayed confirmation', {
          orderId: data.orderId,
          orderNumber: data.orderNumber
        });
        return;
      }

      const tags = this.parseOrderTags(order);

      if (this.hasTag(tags, CONFIRMATION_SENT_TAG)) {
        logger.info('Order confirmation skipped — already sent', {
          orderId: data.orderId,
          orderNumber: data.orderNumber,
          tags
        });
        return;
      }

      if (
        tags.some((tag) =>
          ['confirmed', 'ready_to_ship', 'shipped', 'fulfilled', 'paid', 'cancelled'].includes(
            tag.trim().toLowerCase()
          )
        )
      ) {
        logger.info('Order confirmation skipped — order in final state', {
          orderId: data.orderId,
          orderNumber: data.orderNumber,
          tags
        });
        return;
      }

      await sendOrderConfirmationMessage(
        data.phone,
        data.orderNumber,
        data.customerName
      );

      const newTags = this.withTag(
        this.withoutTag(tags, CONFIRMATION_SCHEDULED_TAG),
        CONFIRMATION_SENT_TAG
      );
      await this.shopifyService.updateOrderTags(data.orderId, newTags);

      logger.info('Order confirmation sent; confirmation_sent tag applied', {
        orderId: data.orderId,
        orderName: data.orderNumber,
        phone: data.phone,
        tags: newTags
      });
    } catch (error) {
      logger.error('Error sending delayed order confirmation message', {
        error,
        orderId: data.orderId,
        orderNumber: data.orderNumber
      });
      throw error;
    }
  }
} 
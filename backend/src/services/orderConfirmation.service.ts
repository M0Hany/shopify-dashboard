import { WhatsAppService } from './whatsapp';
import { ShopifyService } from './shopify';
import { logger } from '../utils/logger';
import { ShopifyOrder } from './shopify';
import { orderConfirmationQueue } from '../jobs/queue';

export class OrderConfirmationService {
  private static instance: OrderConfirmationService;
  private whatsappService: WhatsAppService;
  private shopifyService: ShopifyService;

  private constructor() {
    this.whatsappService = new WhatsAppService();
    this.shopifyService = new ShopifyService();
  }

  public static getInstance(): OrderConfirmationService {
    if (!OrderConfirmationService.instance) {
      OrderConfirmationService.instance = new OrderConfirmationService();
    }
    return OrderConfirmationService.instance;
  }

  public async handleNewOrder(order: ShopifyOrder): Promise<void> {
    try {
      // Check if order already has required tags
      const tags = Array.isArray(order.tags) 
        ? order.tags 
        : typeof order.tags === 'string'
          ? order.tags.split(',').map((t: string) => t.trim())
          : [];

      // Skip if order already has any of these tags
      if (tags.some((tag: string) => [
        'confirmed',
        'ready_to_ship',
        'shipped',
        'fulfilled',
        'paid',
        'cancelled',
        'confirmation_sent'
      ].includes(tag.trim()))) {
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

      // Schedule WhatsApp confirmation message to be sent after 1 hour
      const delay = 60 * 60 * 1000; // 1 hour in milliseconds
      
      await orderConfirmationQueue.add(
        'send-order-confirmation',
        {
          phone,
          orderNumber: order.name,
          customerName: order.customer.first_name,
          orderId: order.id.toString()
        },
        {
          delay,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 60000 // 1 minute
          }
        }
      );

      logger.info('Order confirmation message scheduled to be sent in 1 hour', {
        orderId: order.id,
        orderName: order.name,
        phone: phone,
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

  public async checkPendingOrders(): Promise<void> {
    try {
      logger.info('Checking for pending orders without confirmation');
      
      // Get all orders without the specified tags
      const orders = await this.shopifyService.getOrders({
        excluded_tags: 'confirmed,ready_to_ship,shipped,fulfilled,paid,cancelled,confirmation_sent'
      });

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
      const order = await this.shopifyService.getOrder(data.orderId);
      
      if (!order) {
        logger.warn('Order not found when trying to send delayed confirmation', {
          orderId: data.orderId,
          orderNumber: data.orderNumber
        });
        return;
      }

      const tags = Array.isArray(order.tags) 
        ? order.tags 
        : typeof order.tags === 'string'
          ? order.tags.split(',').map((t: string) => t.trim())
          : [];

      // Skip if order already has confirmation_sent tag or is in a final state
      if (tags.some((tag: string) => [
        'confirmed',
        'ready_to_ship',
        'shipped',
        'fulfilled',
        'paid',
        'cancelled',
        'confirmation_sent'
      ].includes(tag.trim()))) {
        logger.info('Order confirmation skipped - order already processed', {
          orderId: data.orderId,
          orderNumber: data.orderNumber,
          tags
        });
        return;
      }

      // Send WhatsApp confirmation message
      await this.whatsappService.sendOrderConfirmation(
        data.phone,
        data.orderNumber,
        data.customerName
      );

      // Add confirmation_sent tag
      const newTags = [...tags, 'confirmation_sent'];
      await this.shopifyService.updateOrderTags(data.orderId, newTags);

      logger.info('Delayed order confirmation message sent successfully', {
        orderId: data.orderId,
        orderName: data.orderNumber,
        phone: data.phone
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
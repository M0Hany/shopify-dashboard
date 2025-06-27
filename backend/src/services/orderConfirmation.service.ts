import { WhatsAppService } from './whatsapp';
import { ShopifyService } from './shopify';
import { logger } from '../utils/logger';
import { ShopifyOrder } from './shopify';

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

      // Send WhatsApp confirmation message using customer's first name
      await this.whatsappService.sendOrderConfirmation(
        phone,
        order.name,
        order.customer.first_name
      );

      // Add confirmation_sent tag
      const newTags = [...tags, 'confirmation_sent'];
      await this.shopifyService.updateOrderTags(order.id.toString(), newTags);

      logger.info('Order confirmation message sent successfully', {
        orderId: order.id,
        orderName: order.name,
        phone: phone
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
} 
import { OrderStatus } from '../types/order';
import { ShippingService } from './shipping/ShippingService';
import { default as Order, IOrder } from '../models/Order';
import { logger } from '../utils/logger';
import { OrderDTO } from './shipping/types';

interface StatusChangeMetadata {
  orderId: string;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  reason?: string;
}

export class StatusService {
  private static instance: StatusService;
  private shippingService: ShippingService;

  private constructor() {
    this.shippingService = ShippingService.getInstance();
  }

  public static getInstance(): StatusService {
    if (!StatusService.instance) {
      StatusService.instance = new StatusService();
    }
    return StatusService.instance;
  }

  /**
   * Handle status change and trigger appropriate automations
   */
  public async handleStatusChange(metadata: StatusChangeMetadata): Promise<void> {
    try {
      logger.info('Processing status change', { metadata });

      // Get order details
      const order = await Order.findOne({ shopifyId: metadata.orderId });
      if (!order) {
        throw new Error(`Order not found: ${metadata.orderId}`);
      }

      // Update order status
      order.status = metadata.newStatus;
      await order.save();

      // Handle specific status transitions
      switch (metadata.newStatus) {
        case 'ready_to_ship':
          await this.handleReadyToShip(order);
          break;
        case 'shipped':
          await this.handleShipped(metadata);
          break;
        case 'fulfilled':
          await this.handleFulfilled(metadata);
          break;
        case 'cancelled':
          await this.handleCancelled(metadata);
          break;
      }

      logger.info('Status change processed successfully', { 
        orderId: metadata.orderId,
        newStatus: metadata.newStatus 
      });
    } catch (error) {
      logger.error('Error processing status change', {
        error,
        metadata
      });
      throw error;
    }
  }

  /**
   * Handle when an order is ready to ship
   */
  private async handleReadyToShip(order: IOrder): Promise<void> {
    try {
      // Create shipping order using the consolidated ShippingService
      const orderData: OrderDTO = {
        WarehouseName: process.env.SHIPPING_WAREHOUSE_NAME,
        PickupDueDate: new Date().toISOString(),
        Package_Serial: order.name,
        Service_Type: 'DTD' as const, // Door to Door
        Service: 'SD' as const, // Same Day
        COD_Value: parseFloat(order.totalPrice),
        Customer_Name: order.name,
        Mobile_No: order.phone,
        Street: order.shippingAddress?.address1 || '',
        Country: order.shippingAddress?.country || 'Egypt',
        Neighborhood: order.shippingAddress?.city || ''
      };

      await this.shippingService.createOrder(orderData);
      
      logger.info('Shipping order created successfully', {
        orderId: order.shopifyId
      });
    } catch (error) {
      logger.error('Error handling ready_to_ship status', {
        error,
        orderId: order.shopifyId
      });
      throw error;
    }
  }

  /**
   * Handle when an order is shipped
   */
  private async handleShipped(metadata: StatusChangeMetadata): Promise<void> {
    // Add shipping-specific logic here
  }

  /**
   * Handle when an order is fulfilled
   */
  private async handleFulfilled(metadata: StatusChangeMetadata): Promise<void> {
    // Add fulfillment-specific logic here
  }

  /**
   * Handle when an order is cancelled
   */
  private async handleCancelled(metadata: StatusChangeMetadata): Promise<void> {
    // Add cancellation-specific logic here
  }
}

export const statusService = StatusService.getInstance(); 
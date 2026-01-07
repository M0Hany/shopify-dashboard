import { format } from 'date-fns';
import { ShippingService } from './ShippingService';
import { ShopifyOrder, ShopifyService } from '../../services/shopify';
import { updateOrderStatus } from '../../services/shopify';
import { logger } from '../../utils/logger';
import { WhatsAppService } from '../whatsapp';

interface ShippingStatusResponse {
  tabOneOrders: any[];
  tabTwoOrders: any[];
  tabThreeOrders: any[];
}

export class ShippingStatusChecker {
  private static readonly DELIVERY_STATUSES = ["Delivered", "Confirm Delivered"];
  private static readonly RETURN_STATUS = "Ready for Return";
  private static shippingService = ShippingService.getInstance();
  private static shopifyService = new ShopifyService();
  private static whatsappService = new WhatsAppService();

  public static async checkAndUpdateStatuses(): Promise<void> {
    try {
      logger.info('Starting shipping status check');
      
      // Get all orders
      const orders = await this.shopifyService.getOrders({ status: 'any' });
      
      // Filter cancelled orders with shipping barcodes
      const cancelledOrders = orders.filter(order => {
        const tags = Array.isArray(order.tags) ? 
          order.tags.map(t => t.trim()) : 
          typeof order.tags === 'string' ? 
            order.tags.split(',').map(t => t.trim()) : 
            [];
        return tags.includes('cancelled') && tags.some(tag => tag.startsWith('shipping_barcode:'));
      });

      logger.info(`Found ${cancelledOrders.length} cancelled orders with shipping barcodes to check`);

      // Get all shipping statuses
      const shippingResponse = await this.fetchAllShippingStatuses(new Date());
      const shippingStatuses = [
        ...shippingResponse.tabOneOrders,
        ...shippingResponse.tabTwoOrders,
        ...shippingResponse.tabThreeOrders
      ];

      // Process cancelled orders
      await Promise.all(cancelledOrders.map(async (order) => {
        try {
          // Get barcode from order tags
          const tags = Array.isArray(order.tags) ? 
            order.tags : 
            typeof order.tags === 'string' ? 
              order.tags.split(',').map(t => t.trim()) : 
              [];
          const barcodeTag = tags.find(tag => tag.startsWith('shipping_barcode:'));
          const barcode = barcodeTag ? barcodeTag.split(':')[1] : null;

          if (!barcode) {
            logger.warn('No barcode found for cancelled order', { orderId: order.id });
            return;
          }

          // Find matching shipping status
          const shippingStatus = shippingStatuses.find(
            (status: { Barcode: string; PackageENStatus: string }) => status.Barcode === barcode
          );

          if (shippingStatus && shippingStatus.PackageENStatus === "Confirmed received by merchant") {
            // Add deleted tag if not already present
            if (!tags.includes('deleted')) {
              const newTags = [...tags, 'deleted'];
              
              // Update order tags
              await this.shopifyService.updateOrderTags(order.id.toString(), newTags);
              
              logger.info('Added deleted tag to cancelled order', {
                orderId: order.id,
                barcode,
                shippingStatus: shippingStatus.PackageENStatus
              });
            }
          }
        } catch (error) {
          logger.error('Error processing cancelled order', {
            error,
            orderId: order.id
          });
        }
      }));

      // Process shipped orders
      const shippedOrders = orders.filter(order => {
        const tags = Array.isArray(order.tags) ? 
          order.tags.map(t => t.trim()) : 
          typeof order.tags === 'string' ? 
            order.tags.split(',').map(t => t.trim()) : 
            [];
        return tags.includes('shipped');
      });

      logger.info(`Found ${shippedOrders.length} shipped orders to check`);

      // Process ShipBlu orders first (check fulfillments for delivered status)
      const shipBluOrders = shippedOrders.filter(order => {
        const tags = Array.isArray(order.tags) ? 
          order.tags.map(t => t.trim().toLowerCase()) : 
          typeof order.tags === 'string' ? 
            order.tags.split(',').map(t => t.trim().toLowerCase()) : 
            [];
        return tags.includes('sent to shipblu');
      });

      logger.info(`Found ${shipBluOrders.length} ShipBlu shipped orders to check for delivery status`);

      // Process ShipBlu orders - check fulfillments for delivered status
      await Promise.all(shipBluOrders.map(async (order) => {
        try {
          // Check if order has fulfillments with shipment_status === "delivered"
          if (order.fulfillments && Array.isArray(order.fulfillments) && order.fulfillments.length > 0) {
            const deliveredFulfillment = order.fulfillments.find(
              (fulfillment: any) => fulfillment.shipment_status?.toLowerCase() === 'delivered'
            );

            if (deliveredFulfillment) {
              // Get current tags
              const tags = Array.isArray(order.tags) ? 
                order.tags.map(t => t.trim()) : 
                typeof order.tags === 'string' ? 
                  order.tags.split(',').map(t => t.trim()) : 
                  [];

              // Remove shipped tag and add fulfilled tag
              const newTags = tags.filter(tag => 
                tag.toLowerCase() !== 'shipped' && !tag.toLowerCase().startsWith('fulfillment_date:')
              );
              
              // Add fulfilled tag
              newTags.push('fulfilled');
              
              // Add fulfillment date tag
              const today = format(new Date(), 'yyyy-MM-dd');
              newTags.push(`fulfillment_date:${today}`);

              // Update order tags
              await this.shopifyService.updateOrderTags(order.id.toString(), newTags);
              
              logger.info('Updated ShipBlu order status to fulfilled (delivered)', {
                orderId: order.id,
                orderName: order.name,
                shipmentStatus: deliveredFulfillment.shipment_status,
                previousStatus: 'shipped',
                newStatus: 'fulfilled'
              });
            }
          }
        } catch (error) {
          logger.error('Error processing ShipBlu shipped order', {
            error,
            orderId: order.id
          });
        }
      }));


      // Continue with existing ready to ship orders check
      const readyToShipOrders = orders.filter(order => {
        const tags = Array.isArray(order.tags) ? 
          order.tags.map(t => t.trim()) : 
          typeof order.tags === 'string' ? 
            order.tags.split(',').map(t => t.trim()) : 
            [];
        return tags.includes('ready_to_ship');
      });

      logger.info(`Found ${readyToShipOrders.length} ready to ship orders`);
      
      if (readyToShipOrders.length === 0) {
        logger.info('No ready to ship orders to check');
        return;
      }

      // Get barcodes from ready to ship orders
      const barcodes = readyToShipOrders.map(order => {
        const tags = Array.isArray(order.tags) ? 
          order.tags : 
          typeof order.tags === 'string' ? 
            order.tags.split(',').map(t => t.trim()) : 
            [];
        const barcodeTag = tags.find(tag => tag.startsWith('shipping_barcode:'));
        return barcodeTag ? barcodeTag.split(':')[1] : null;
      }).filter(Boolean);

      logger.info(`Found ${barcodes.length} barcodes to check`);

      // Fetch shipping statuses for all barcodes
      const shippingData = await this.fetchAllShippingStatuses(new Date());
      const allShippingOrders = [
        ...shippingData.tabOneOrders,
        ...shippingData.tabTwoOrders,
        ...shippingData.tabThreeOrders
      ];

      // Process each ready to ship order
      await Promise.all(readyToShipOrders.map(async (order) => {
        try {
          // Get barcode from order tags
          const tags = Array.isArray(order.tags) ? 
            order.tags : 
            typeof order.tags === 'string' ? 
              order.tags.split(',').map(t => t.trim()) : 
              [];
          const barcodeTag = tags.find(tag => tag.startsWith('shipping_barcode:'));
          const barcode = barcodeTag ? barcodeTag.split(':')[1] : null;

          if (!barcode) {
            logger.warn('No barcode found for order', { orderId: order.id });
            return;
          }

          // Find matching shipping status
          const shippingStatus = allShippingOrders.find(
            status => status.Barcode === barcode
          );

          if (shippingStatus) {
            // If package is picked up (status is not "Pending pickup" or similar)
            if (shippingStatus.PackageENStatus !== 'Pending pickup' && 
                shippingStatus.PackageENStatus !== 'Waiting for pickup') {
              // Remove ready to ship tag and add shipped tag
              const newTags = tags.filter(tag => 
                tag !== 'ready_to_ship' && !tag.startsWith('shipping_date:')
              );
              
              // Add shipped tag
              newTags.push('shipped');
              
              // Add shipping date tag with current date
              const today = new Date().toISOString().split('T')[0];
              newTags.push(`shipping_date:${today}`);

              // Update order tags
              await this.shopifyService.updateOrderTags(order.id.toString(), newTags);
              
              logger.info('Updated order status to shipped', {
                orderId: order.id,
                barcode,
                shippingDate: today,
                shippingStatus: shippingStatus.PackageENStatus
              });
            }
          }
        } catch (error) {
          logger.error('Error processing order', {
            orderId: order.id,
            error
          });
        }
      }));
      
      logger.info('Completed shipping status check');
    } catch (error) {
      logger.error('Error in shipping status checker:', error);
    }
  }

  private static findOldestShippedOrderDate(orders: ShopifyOrder[]): Date {
    const shippingDates = orders
      .map(order => {
        const tags = Array.isArray(order.tags) ? 
          order.tags : 
          typeof order.tags === 'string' ? 
            order.tags.split(',').map(t => t.trim()) : 
            [];
            
        const shippingDateTag = tags
          .find((tag: string) => tag.trim().startsWith('shipping_date:'));
        
        if (shippingDateTag) {
          const dateStr = shippingDateTag.trim().split(':')[1]?.trim();
          if (dateStr) {
            logger.info('Found shipping date for order:', {
              orderName: order.name,
              shippingDate: dateStr
            });
            return new Date(dateStr);
          }
        }
        return null;
      })
      .filter((date): date is Date => date !== null);

    if (shippingDates.length === 0) {
      // If no shipping dates found, use 30 days ago as default
      const date = new Date();
      date.setDate(date.getDate() - 30);
      logger.info('No shipping dates found, using default date:', date);
      return date;
    }

    const oldestDate = new Date(Math.min(...shippingDates.map(date => date.getTime())));
    logger.info('Oldest shipping date:', oldestDate);
    return oldestDate;
  }

  private static async fetchAllShippingStatuses(fromDate: Date): Promise<ShippingStatusResponse> {
    const toDate = new Date();
    
    // Get date from 7 days ago
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    // Format dates for API - use weekAgo instead of fromDate
    const from = weekAgo.toISOString().split('T')[0] + 'T20:00:00.000Z';
    const to = toDate.toISOString().split('T')[0] + 'T20:59:59.000Z';

    logger.info(`Fetching shipping statuses for the past week`);

    // Base payload
    const basePayload = {
      FilterModel: {
        PageFilter: {
          PageIndex: 1,
          PageSize: 500 // Increased page size to handle more orders
        },
        SearchKeyword: ""
      },
      From: from,
      To: to,
      MerchantIds: [16677],
      WarehouseIds: [],
      SubscriberIds: [],
      HubId: [],
      HubTypeId: 0,
      PhaseId: [],
      MylerIds: [],
      TransferBy: [],
      ServiceTypeId: [],
      ServiceCategoryId: [],
      PaymentTypeId: [],
      StatusId: [],
      PackageServiceId: [],
      AttemptsNumber: null,
      MemberId: 22376,
      Barcodes: [],
      PreferedTimeSlot: 0,
      AvailableTimeslotId: 0,
      DateTypeId: 3,
      SearchOptionId: 1,
      MemberCategoryID: 2
    };

    // Fetch from all tabs concurrently
    const [tabOne, tabTwo, tabThree] = await Promise.all([
      this.shippingService.getPackagesList({ ...basePayload, SelectedTab: 1 }),
      this.shippingService.getPackagesList({ ...basePayload, SelectedTab: 2 }),
      this.shippingService.getPackagesList({ ...basePayload, SelectedTab: 3 })
    ]);

    return {
      tabOneOrders: tabOne.Value.Result,
      tabTwoOrders: tabTwo.Value.Result,
      tabThreeOrders: tabThree.Value.Result
    };
  }

  private static async processOrders(orders: ShopifyOrder[], shippingData: ShippingStatusResponse): Promise<void> {
    const allShippingOrders = [
      ...shippingData.tabOneOrders,
      ...shippingData.tabTwoOrders,
      ...shippingData.tabThreeOrders
    ];

    logger.info(`Processing ${orders.length} orders against ${allShippingOrders.length} shipping records`);

    for (const order of orders) {
      try {
        // Format phone number
        let formattedPhone = order.customer.phone.replace(/\D/g, '');
        if (formattedPhone.startsWith('20')) {
          formattedPhone = formattedPhone.substring(2);
        }
        if (!formattedPhone.startsWith('0')) {
          formattedPhone = '0' + formattedPhone;
        }

        logger.info('Processing order', {
          orderName: order.name,
          customerName: order.customer.first_name,
          formattedPhone
        });

        // Find matching shipping status
        const matchingStatus = allShippingOrders.find(shipping => {
          const shippingPhone = shipping.PhoneNo?.replace(/\D/g, '') || '';
          const normalizedShippingPhone = shippingPhone.startsWith('0') ? 
            shippingPhone : `0${shippingPhone}`;
          
          const matches = normalizedShippingPhone === formattedPhone &&
            shipping.CustomerName?.toLowerCase().includes(order.customer.first_name.toLowerCase());

          if (matches) {
            logger.info('Found matching shipping record', {
              orderName: order.name,
              shippingStatus: shipping.PackageENStatus,
              customerName: shipping.CustomerName
            });
          }

          return matches;
        });

        if (matchingStatus && this.DELIVERY_STATUSES.includes(matchingStatus.PackageENStatus)) {
          logger.info('Auto-fulfilling order due to delivery confirmation', {
            orderName: order.name,
            status: matchingStatus.PackageENStatus
          });

          // Add fulfillment date and update status
          const today = format(new Date(), 'yyyy-MM-dd');
          const tags = Array.isArray(order.tags) ? 
            order.tags : 
            typeof order.tags === 'string' ? 
              order.tags.split(',').map(t => t.trim()) : 
              [];

          const newTags = [
            ...tags.filter((tag: string) => tag !== 'shipped'),
            'fulfilled',
            `fulfillment_date:${today}`
          ];

          // Update order in Shopify
          await updateOrderStatus(order.id, newTags);
          logger.info('Successfully updated order status', {
            orderName: order.name,
            newTags
          });

          // Send WhatsApp delivery confirmation
          try {
            await this.whatsappService.sendDeliveryConfirmation(
              order.customer.phone,
              order.name,
              order.customer.first_name
            );
            logger.info('WhatsApp delivery confirmation sent', {
              orderName: order.name,
              phone: order.customer.phone
            });
          } catch (whatsappError) {
            logger.error('Failed to send WhatsApp delivery confirmation', {
              error: whatsappError,
              orderName: order.name
            });
            // Don't throw the error - we don't want to stop processing other orders
          }
        } else {
          logger.info('No status update needed', {
            orderName: order.name,
            matchFound: !!matchingStatus,
            status: matchingStatus?.PackageENStatus
          });
        }
      } catch (error) {
        logger.error(`Error processing order ${order.name}:`, error);
      }
    }
  }
} 
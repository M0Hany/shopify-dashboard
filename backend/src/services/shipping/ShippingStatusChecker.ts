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
  private static shippingService = ShippingService.getInstance();
  private static shopifyService = new ShopifyService();
  private static whatsappService = new WhatsAppService();

  public static async checkAndUpdateStatuses(): Promise<void> {
    try {
      logger.info('Starting shipping status check');
      
      // Get all shipped but not fulfilled orders
      const orders = await this.shopifyService.getOrders({ status: 'shipped' });
      logger.info(`Found ${orders.length} total orders`);
      
      const shippedOrders = orders.filter(order => {
        const tags = Array.isArray(order.tags) ? 
          order.tags : 
          typeof order.tags === 'string' ? 
            order.tags.split(',').map(t => t.trim()) : 
            [];
        return tags.includes('shipped') && !tags.includes('fulfilled');
      });
      
      logger.info(`Found ${shippedOrders.length} shipped but not fulfilled orders`);
      
      if (shippedOrders.length === 0) {
        logger.info('No shipped orders to check');
        return;
      }

      // Find oldest shipped order date
      const oldestDate = this.findOldestShippedOrderDate(shippedOrders);
      logger.info('Checking shipping statuses from:', oldestDate);

      // Fetch shipping statuses
      const shippingData = await this.fetchAllShippingStatuses(oldestDate);
      const totalShippingOrders = 
        shippingData.tabOneOrders.length + 
        shippingData.tabTwoOrders.length + 
        shippingData.tabThreeOrders.length;
      
      logger.info(`Found ${totalShippingOrders} total shipping orders`, {
        tabOne: shippingData.tabOneOrders.length,
        tabTwo: shippingData.tabTwoOrders.length,
        tabThree: shippingData.tabThreeOrders.length
      });
      
      // Process each shipped order
      await this.processOrders(shippedOrders, shippingData);
      
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
    
    // Format dates for API
    const from = fromDate.toISOString().split('T')[0] + 'T20:00:00.000Z';
    const to = toDate.toISOString().split('T')[0] + 'T20:59:59.000Z';

    logger.info('Fetching shipping statuses', { from, to });

    // Base payload
    const basePayload = {
      FilterModel: {
        PageFilter: {
          PageIndex: 1,
          PageSize: 100
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
    logger.info('Fetching packages from all tabs');
    const [tabOne, tabTwo, tabThree] = await Promise.all([
      this.shippingService.getPackagesList({ ...basePayload, SelectedTab: 1 }),
      this.shippingService.getPackagesList({ ...basePayload, SelectedTab: 2 }),
      this.shippingService.getPackagesList({ ...basePayload, SelectedTab: 3 })
    ]);

    logger.info('Successfully fetched packages from all tabs', {
      tabOneCount: tabOne.Value.Result.length,
      tabTwoCount: tabTwo.Value.Result.length,
      tabThreeCount: tabThree.Value.Result.length
    });

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
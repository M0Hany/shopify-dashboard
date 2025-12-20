import '@shopify/shopify-api/adapters/node';
import { shopifyApi, ApiVersion, Session, RequestReturn, AuthScopes } from '@shopify/shopify-api';
import { OrderStatus } from '../types/order';
import { logger } from '../utils/logger';

interface CustomerDetails {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  defaultAddress?: {
    formattedArea: string;
    address1: string;
    phone: string;
  };
}

export interface ShopifyOrder {
  id: number;
  name: string;
  email: string;
  phone: string;
  total_price: string;
  financial_status: string;
  fulfillment_status: string;
  tags: string[] | string | null;
  created_at: string;
  updated_at: string;
  payment_gateway_names?: string[]; // include payment methods used
  custom_due_date?: string;
  line_items: {
    title: string;
    quantity: number;
    price: string;
    variant_title: string | null;
    properties?: Array<{
      name: string;
      value: string;
    }>;
  }[];
  customer: {
    id: number;
    first_name: string;
    last_name: string;
    phone: string;
  };
  shipping_address: {
    phone: string;
    address1: string;
    address2?: string;
    city: string;
    province: string;
    zip: string;
    country: string;
  };
  fulfillments?: Array<{
    id: number;
    status: string;
    shipment_status?: string;
    tracking_company?: string;
    tracking_number?: string;
    created_at?: string;
    updated_at?: string;
  }>;
}

const SHOPIFY_SCOPES = new AuthScopes([
  'read_orders',
  'write_orders',
  'read_fulfillments',
  'write_fulfillments',
  'read_customers',
  'write_customers',
  'read_tags',
  'write_tags'
]);

// Initialize Shopify API client
const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY || '',
  apiSecretKey: process.env.SHOPIFY_API_SECRET || '',
  scopes: SHOPIFY_SCOPES,
  hostName: process.env.SHOPIFY_SHOP_NAME || '',
  apiVersion: ApiVersion.October23,
  isEmbeddedApp: false,
  isCustomStoreApp: true,
  adminApiAccessToken: process.env.SHOPIFY_ACCESS_TOKEN || ''
});

export class ShopifyService {
  private client: InstanceType<typeof shopify.clients.Rest>;
  private session: Session;

  constructor() {
    this.session = new Session({
      id: '1',
      shop: process.env.SHOPIFY_SHOP_URL || '',
      state: 'active',
      isOnline: true,
      accessToken: process.env.SHOPIFY_ACCESS_TOKEN || '',
      scope: SHOPIFY_SCOPES.toString()
    });

    this.client = new shopify.clients.Rest({
      session: this.session,
      apiVersion: ApiVersion.October23
    });
  }

  async getCustomerDetails(customerId: string): Promise<CustomerDetails> {
    try {
      const client = new shopify.clients.Graphql({ session: this.session });
      const response = await client.query({
        data: `query {
          customer(id: "${customerId}") {
            id
            firstName
            lastName
            email
            phone
            defaultAddress {
              formattedArea
              address1
              phone
            }
          }
        }`,
      });

      const responseBody = response.body as unknown as { data?: { customer?: CustomerDetails } };
      if (!responseBody?.data?.customer) {
        throw new Error('Invalid response format from Shopify API');
      }

      return responseBody.data.customer;
    } catch (error) {
      logger.error('Error fetching customer details:', error);
      throw new Error('Failed to fetch customer details from Shopify');
    }
  }

  async getOrders(params: {
    limit?: number;
    status?: string;
    created_at_min?: string;
    created_at_max?: string;
    excluded_tags?: string;
  }): Promise<ShopifyOrder[]> {
    try {
      const allOrders: ShopifyOrder[] = [];
      let hasNextPage = true;
      let pageInfo = '';

      while (hasNextPage) {
        const query: Record<string, string | number> = {
          limit: params.limit ? Math.min(250, params.limit - allOrders.length) : 250,
          status: 'any',
          fields: 'id,name,email,phone,total_price,financial_status,fulfillment_status,tags,created_at,updated_at,line_items,customer,shipping_address,shipping_address.address1,shipping_address.address2,shipping_address.city,shipping_address.province,shipping_address.zip,shipping_address.country,line_items.variant_title,line_items.properties,note,payment_gateway_names,fulfillments'
        };

        // Map status to tag for filtering
        if (params.status && params.status !== 'any') {
          const statusToTag: Record<string, string> = {
            'pending': 'customer_confirmed',
            'confirmed': 'customer_confirmed',
            'ready-to-ship': 'ready_to_ship',
            'shipped': 'shipped',
            'fulfilled': 'fulfilled',
            'cancelled': 'cancelled',
            'paid': 'paid'
          };
          
          const tag = statusToTag[params.status.trim()];
          if (tag) {
            query.tag = tag;
          }
        }

        // Add excluded tags as a query filter
        if (params.excluded_tags) {
          const excludedTagsList = params.excluded_tags
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag); // Remove empty strings

          logger.debug('Processing excluded tags:', {
            original: params.excluded_tags,
            processed: excludedTagsList
          });

          // Use Shopify's query syntax for tag filtering
          if (excludedTagsList.length > 0) {
            const tagFilter = excludedTagsList.map(tag => `NOT tag:${tag}`).join(' AND ');
            query.query = tagFilter;
          }
        }

        if (params.created_at_min) query.created_at_min = params.created_at_min;
        if (params.created_at_max) query.created_at_max = params.created_at_max;
        if (pageInfo) query.page_info = pageInfo;

        logger.debug('Fetching orders with query:', query);

        interface ShopifyOrderResponse {
          orders: ShopifyOrder[];
        }

        const response = await this.client.get({
          path: '/admin/api/2023-10/orders.json',
          query
        }) as RequestReturn & { 
          headers: Headers;
          body: ShopifyOrderResponse;
        };

        if (!response.body?.orders) {
          throw new Error('No orders found in response');
        }

        const ordersWithCustomerDetails = await Promise.all(
          response.body.orders.map(async (order: ShopifyOrder) => {
            if (order.customer?.id) {
              try {
                const customerDetails = await this.getCustomerDetails(
                  `gid://shopify/Customer/${order.customer.id}`
                );
                return {
                  ...order,
                  customer: {
                    ...order.customer,
                    first_name: customerDetails.firstName,
                    last_name: customerDetails.lastName,
                    phone: customerDetails.phone || customerDetails.defaultAddress?.phone || order.customer.phone
                  }
                };
              } catch (error) {
                logger.error(`Failed to fetch details for customer ${order.customer.id}:`, error);
                return order;
              }
            }
            return order;
          })
        );

        allOrders.push(...ordersWithCustomerDetails);

        // Check if there are more pages using the Link header
        const linkHeader = response.headers['link'] || response.headers['Link'];
        if (linkHeader && typeof linkHeader === 'string' && linkHeader.includes('rel="next"')) {
          const match = linkHeader.match(/page_info=([^>]+)>/);
          if (match) {
            pageInfo = match[1];
          }
        } else {
          hasNextPage = false;
        }

        // If we've reached the requested limit, stop fetching
        if (params.limit && allOrders.length >= params.limit) {
          hasNextPage = false;
          allOrders.splice(params.limit); // Trim to exact limit
        }
      }

      return allOrders;
    } catch (error) {
      logger.error('Error fetching orders:', error);
      throw new Error('Failed to fetch orders from Shopify');
    }
  }

  async getOrder(id: number): Promise<ShopifyOrder> {
    try {
      const response = await this.client.get({
        path: `/admin/api/2022-10/orders/${id}.json`,
      }) as unknown as RequestReturn<{ order?: ShopifyOrder }>;

      if (!response.body.order) {
        throw new Error('Order not found');
      }

      return response.body.order;
    } catch (error) {
      console.error('Error fetching order:', error);
      throw new Error('Failed to fetch order from Shopify');
    }
  }

  async updateOrderStatus(orderId: number, status: string, previousStatus?: string): Promise<void> {
    try {
      // Get the current order to check existing tags
      const order = await this.getOrder(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      // Get existing tags and ensure they are trimmed
      const existingTags = typeof order.tags === 'string' 
        ? order.tags.split(',').map((tag: string) => tag.trim())
        : Array.isArray(order.tags)
          ? order.tags.map((tag: string) => tag.trim())
          : [];
      
      // Determine previous status if not provided
      if (!previousStatus) {
        const statusTags = ['order_ready', 'customer_confirmed', 'ready_to_ship', 'ready-to-ship', 'shipped', 'fulfilled', 'cancelled'];
        const existingStatusTag = existingTags.find((tag: string) => 
          statusTags.some(st => tag.trim().toLowerCase() === st.trim().toLowerCase())
        );
        if (existingStatusTag) {
          const trimmed = existingStatusTag.trim().toLowerCase();
          // Normalize ready-to-ship to ready_to_ship
          previousStatus = trimmed === 'ready-to-ship' ? 'ready_to_ship' : trimmed;
        } else {
          previousStatus = 'pending';
        }
      } else {
        // Normalize previous status (handle ready-to-ship -> ready_to_ship)
        const trimmed = previousStatus.trim().toLowerCase();
        previousStatus = trimmed === 'ready-to-ship' ? 'ready_to_ship' : trimmed;
      }
      
      // Filter out existing status tags and shipping date tag (case-insensitive)
      const statusTags = ['order_ready', 'customer_confirmed', 'ready_to_ship', 'ready-to-ship', 'shipped', 'fulfilled', 'cancelled'].map(tag => tag.trim().toLowerCase());
      const filteredTags = existingTags.filter((tag: string) => {
        const trimmed = tag.trim().toLowerCase();
        return !statusTags.includes(trimmed) && !tag.trim().startsWith('shipping_date:');
      });

      // Add new status tag if not pending (ensure it's trimmed)
      const trimmedStatus = status.trim().toLowerCase();
      if (trimmedStatus !== 'pending') {
        filteredTags.push(status.trim());
      }

      // If moving from ready_to_ship (or ready-to-ship) to shipped, add shipping date tag
      const normalizedPreviousStatus = previousStatus.trim().toLowerCase();
      const normalizedNewStatus = status.trim().toLowerCase();
      // Check for both ready_to_ship and ready-to-ship variations
      const isReadyToShip = normalizedPreviousStatus === 'ready_to_ship' || normalizedPreviousStatus === 'ready-to-ship';
      const isShipped = normalizedNewStatus === 'shipped';
      
      logger.info('Checking shipping date tag addition', {
        orderId,
        previousStatus,
        normalizedPreviousStatus,
        status,
        normalizedNewStatus,
        isReadyToShip,
        isShipped,
        willAddShippingDate: isReadyToShip && isShipped,
        existingTags: existingTags,
        filteredTagsBefore: filteredTags
      });
      
      if (isReadyToShip && isShipped) {
        const today = new Date();
        const shippingDate = today.toISOString().split('T')[0]; // Get only YYYY-MM-DD
        const shippingDateTag = `shipping_date:${shippingDate}`;
        filteredTags.push(shippingDateTag);
        logger.info('Added shipping_date tag', {
          orderId,
          shippingDate,
          shippingDateTag,
          filteredTagsAfter: filteredTags
        });
      } else {
        logger.warn('Shipping date tag NOT added', {
          orderId,
          reason: !isReadyToShip ? 'Previous status is not ready_to_ship' : 'New status is not shipped',
          previousStatus,
          normalizedPreviousStatus,
          status,
          normalizedNewStatus
        });
      }

      // Remove priority tag if status is fulfilled or cancelled
      if (status.trim() === 'fulfilled' || status.trim() === 'cancelled') {
        const priorityIndex = filteredTags.findIndex(tag => tag.trim() === 'priority');
        if (priorityIndex > -1) {
          filteredTags.splice(priorityIndex, 1);
        }
      }

      // Update the order with new tags (ensure all tags are trimmed before joining)
      await this.client.put({
        path: `orders/${orderId}`,
        data: {
          order: {
            tags: filteredTags.map(tag => tag.trim()).join(', ')
          }
        }
      });
    } catch (error: unknown) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }

  async updateOrderDueDate(orderId: number, customDueDate: string): Promise<void> {
    try {
      // First get the current order to preserve other fields
      const currentOrder = await this.getOrder(orderId);
      
      // Format the date to YYYY-MM-DD for the tag
      const formattedDate = new Date(customDueDate).toISOString().split('T')[0];
      
      // Convert tags to array if it's a string
      const existingTags = typeof currentOrder.tags === 'string' 
        ? currentOrder.tags.split(',') 
        : Array.isArray(currentOrder.tags) 
          ? currentOrder.tags 
          : [];
      
      // Remove any existing custom due date tags and trim all tags
      const filteredTags = existingTags
        .map((tag: string) => tag.trim())
        .filter((tag: string) => !tag.startsWith('custom_due_date:'));
      
      // Add the new custom due date tag
      const finalTags = [...filteredTags, `custom_due_date:${formattedDate}`];
      
      // Update the order with the new due date tag
      await this.client.put({
        path: `/admin/api/2023-10/orders/${orderId}.json`,
        data: {
          order: {
            id: orderId,
            tags: finalTags
          }
        }
      });
    } catch (error) {
      console.error('Error updating order due date:', error);
      throw new Error('Failed to update order due date in Shopify');
    }
  }

  async updateOrderStartDate(orderId: number, customStartDate: string): Promise<void> {
    try {
      console.log('Starting updateOrderStartDate method:', { orderId, customStartDate });
      // First get the current order to preserve other fields
      const currentOrder = await this.getOrder(orderId);
      console.log('Current order retrieved:', { tags: currentOrder.tags });
      
      // Format the date to YYYY-MM-DD for the tag
      const formattedDate = new Date(customStartDate).toISOString().split('T')[0];
      console.log('Formatted date:', formattedDate);
      
      // Convert tags to array if it's a string
      const existingTags = typeof currentOrder.tags === 'string' 
        ? currentOrder.tags.split(',') 
        : Array.isArray(currentOrder.tags) 
          ? currentOrder.tags 
          : [];
      console.log('Existing tags:', existingTags);
      
      // Remove any existing custom start date tags
      const filteredTags = existingTags.filter((tag: string) => !tag.startsWith('custom_start_date:'));
      console.log('Filtered tags:', filteredTags);
      
      const finalTags = [...filteredTags, `custom_start_date:${formattedDate}`];
      console.log('Final tags:', finalTags);
      
      // Update the order with the new start date tag
      console.log('Sending update to Shopify API');
      await this.client.put({
        path: `/admin/api/2023-10/orders/${orderId}.json`,
        data: {
          order: {
            id: orderId,
            tags: finalTags
          }
        }
      });
      console.log('Order successfully updated with new start date tag');
    } catch (error) {
      console.error('Error updating order start date:', error);
      throw new Error('Failed to update order start date in Shopify');
    }
  }

  async updateOrderNote(id: number, note: string): Promise<void> {
    try {
      await this.client.put({
        path: `/admin/api/2022-10/orders/${id}.json`,
        data: {
          order: {
            id,
            note
          }
        }
      });
    } catch (error) {
      console.error('Error updating order note:', error);
      throw new Error('Failed to update order note in Shopify');
    }
  }

  async updateOrderPriority(id: number, isPriority: boolean): Promise<void> {
    try {
      // First get the current order to preserve other fields
      const currentOrder = await this.getOrder(id);
      
      // Convert tags to array if it's a string
      const existingTags = typeof currentOrder.tags === 'string' 
        ? currentOrder.tags.split(',').map((tag: string) => tag.trim()) 
        : Array.isArray(currentOrder.tags) 
          ? currentOrder.tags.map((tag: string) => tag.trim()) 
          : [];
      
      // Remove priority tag if it exists
      const filteredTags = existingTags.filter((tag: string) => tag.trim() !== 'priority');
      
      // Add priority tag if isPriority is true
      const newTags = isPriority ? [...filteredTags, 'priority'] : filteredTags;
      
      // Update the order with the new tags
      await this.client.put({
        path: `/admin/api/2023-10/orders/${id}.json`,
        data: {
          order: {
            id,
            tags: newTags
          }
        }
      });
    } catch (error) {
      console.error('Error updating order priority:', error);
      throw new Error('Failed to update order priority in Shopify');
    }
  }

  async fulfillOrder(id: number): Promise<void> {
    try {
      // Get the order to find line items
      const order = await this.getOrder(id);
      
      // Get fulfillable line items
      const fulfillmentOrderResponse = await this.client.get({
        path: `/admin/api/2023-10/orders/${id}/fulfillment_orders.json`
      });
      
      if (!fulfillmentOrderResponse.body.fulfillment_orders || 
          fulfillmentOrderResponse.body.fulfillment_orders.length === 0) {
        throw new Error('No fulfillment orders available for this order');
      }
      
      // Get the first fulfillment order
      const fulfillmentOrder = fulfillmentOrderResponse.body.fulfillment_orders[0];
      
      // Check if the fulfillment order is already closed
      if (fulfillmentOrder.status === 'closed') {
        throw new Error('This order has already been fulfilled');
      }
      
      // Check if the fulfillment order is fulfillable
      if (fulfillmentOrder.status !== 'open') {
        throw new Error(`Cannot fulfill order: fulfillment order status is ${fulfillmentOrder.status}`);
      }
      
      // Create a fulfillment with line items
      const response = await this.client.post({
        path: `/admin/api/2023-10/fulfillments.json`,
        data: {
          fulfillment: {
            fulfillment_order_id: fulfillmentOrder.id,
            notify_customer: true,
            line_items_by_fulfillment_order: [{
              fulfillment_order_id: fulfillmentOrder.id,
              fulfillment_order_line_items: fulfillmentOrder.line_items.map((item: any) => ({
                id: item.id,
                quantity: item.quantity
              }))
            }]
          }
        }
      });

      if (!response.body.fulfillment) {
        throw new Error('Failed to create fulfillment - no fulfillment returned in response');
      }

      // After successful fulfillment, remove all status-related tags
      const currentOrder = await this.getOrder(id);
      const existingTags = typeof currentOrder.tags === 'string' 
        ? currentOrder.tags.split(',').map((tag: string) => tag.trim()) 
        : Array.isArray(currentOrder.tags) 
          ? currentOrder.tags.map((tag: string) => tag.trim()) 
          : [];
      
      // Remove all status-related tags
      const statusTags = ['customer_confirmed', 'ready_to_ship', 'shipped', 'express', 'overdue'];
      const filteredTags = existingTags.filter((tag: string) => !statusTags.includes(tag.trim()));
      
      // Update the order with the filtered tags
      await this.client.put({
        path: `/admin/api/2023-10/orders/${id}.json`,
        data: {
          order: {
            id,
            tags: filteredTags
          }
        }
      });
    } catch (error: unknown) {
      // Type guard to check if error is an object with response property
      interface ShopifyError {
        message: string;
        response?: {
          body?: unknown;
          url?: string;
        };
      }

      const shopifyError = error as ShopifyError;
      
      console.error('Error fulfilling order:', {
        error: shopifyError,
        orderId: id,
        errorDetails: shopifyError.response?.body || shopifyError.message,
        requestUrl: shopifyError.response?.url
      });
      
      throw new Error(`Failed to fulfill order in Shopify: ${shopifyError.message}`);
    }
  }

  async deleteOrder(id: number): Promise<void> {
    try {
      // First get the order to check if it's cancelled
      const order = await this.getOrder(id);
      if (!order) {
        throw new Error('Order not found');
      }

      // Check if the order is cancelled
      const tags = typeof order.tags === 'string' 
        ? order.tags.split(',').map((tag: string) => tag.trim())
        : Array.isArray(order.tags)
          ? order.tags.map((tag: string) => tag.trim())
          : [];

      if (!tags.includes('cancelled')) {
        throw new Error('Only cancelled orders can be deleted');
      }

      // Delete the order
      await this.client.delete({
        path: `/admin/api/2023-10/orders/${id}.json`
      });
    } catch (error: unknown) {
      console.error('Error deleting order:', {
        error,
        orderId: id,
        errorDetails: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(error instanceof Error ? error.message : 'Failed to delete order from Shopify');
    }
  }

  async findOrderByBarcode(barcode: string): Promise<ShopifyOrder | null> {
    try {
      // Get all orders
      const response = await this.client.get({
        path: 'orders',
        query: {
          status: 'any',
          limit: 250
        }
      });

      const orders = response.body.orders;

      // Find matching order by barcode in tags
      const matchingOrder = orders.find((order: ShopifyOrder) => {
        const tags = Array.isArray(order.tags) ? 
          order.tags : 
          typeof order.tags === 'string' ? 
            order.tags.split(',').map(t => t.trim()) : 
            [];
        
        const barcodeTag = tags.find(tag => tag.startsWith('shipping_barcode:'));
        if (!barcodeTag) {
          return false;
        }

        const orderBarcode = barcodeTag.split(':')[1]?.trim();
        return orderBarcode === barcode.trim();
      });

      return matchingOrder || null;
    } catch (error) {
      console.error('Error finding order by barcode:', error);
      throw error;
    }
  }

  async findOrderByOrderNumber(orderNumber: string): Promise<ShopifyOrder | null> {
    try {
      // Get all orders
      const response = await this.client.get({
        path: 'orders',
        query: {
          status: 'any',
          limit: 250
        }
      });

      const orders = response.body.orders;

      // Find matching order by order number (name field)
      const matchingOrder = orders.find((order: ShopifyOrder) => {
        return order.name === orderNumber;
      });

      return matchingOrder || null;
    } catch (error) {
      console.error('Error finding order by order number:', error);
      throw error;
    }
  }

  async findOrderByCustomerDetails(customerName: string, customerPhone: string): Promise<ShopifyOrder | null> {
    try {
      // Get all orders
      const response = await this.client.get({
        path: 'orders',
        query: {
          status: 'any',
          limit: 250
        }
      });

      const orders = response.body.orders;

      // Format the search phone number
      let searchCustomerPhone = customerPhone.replace(/\D/g, '');
      // Add leading 2 if not present, keeping the leading 0
      if (!searchCustomerPhone.startsWith('2')) {
        searchCustomerPhone = '2' + searchCustomerPhone;
      }

      console.log('Formatted search phone:', {
        original: customerPhone,
        formatted: searchCustomerPhone
      });

      // Find matching order
      const matchingOrder = orders.find((order: ShopifyOrder) => {
        const orderCustomerName = `${order.customer?.first_name} ${order.customer?.last_name}`.toLowerCase();
        let orderShippingPhone = order.shipping_address?.phone?.replace(/\D/g, '');

        // Format the shipping address phone number the same way
        if (orderShippingPhone && !orderShippingPhone.startsWith('2')) {
          orderShippingPhone = '2' + orderShippingPhone;
        }

        console.log('Comparing phones:', {
          orderName: orderCustomerName,
          searchName: customerName.toLowerCase(),
          orderPhone: orderShippingPhone,
          searchPhone: searchCustomerPhone
        });

        return orderCustomerName === customerName.toLowerCase() && 
               orderShippingPhone === searchCustomerPhone;
      });

      return matchingOrder || null;
    } catch (error) {
      console.error('Error finding order by customer details:', error);
      throw error;
    }
  }

  async addOrderTag(orderId: number, tag: string): Promise<void> {
    try {
      // Get the current order to check existing tags
      const order = await this.getOrder(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      // Get existing tags and ensure they are trimmed
      const existingTags = typeof order.tags === 'string' 
        ? order.tags.split(',').map((tag: string) => tag.trim())
        : Array.isArray(order.tags)
          ? order.tags.map((tag: string) => tag.trim())
          : [];

      // Add new tag if it doesn't exist
      if (!existingTags.includes(tag.trim())) {
        existingTags.push(tag.trim());
      }

      // Update the order with new tags
      await this.client.put({
        path: `orders/${orderId}`,
        data: {
          order: {
            tags: existingTags.join(', ')
          }
        }
      });
    } catch (error) {
      console.error('Error adding order tag:', error);
      throw error;
    }
  }

  async updateOrderTags(orderId: string, tags: string[]): Promise<void> {
    try {
      await this.client.put({
        path: `orders/${orderId}`,
        data: {
          order: {
            id: orderId,
            tags: tags.join(',')
          }
        }
      });
    } catch (error) {
      logger.error('Error updating order tags:', error);
      throw error;
    }
  }

  async getOrdersByPhone(phone: string): Promise<ShopifyOrder[]> {
    try {
      // Remove all non-digit characters
      const cleanPhone = phone.replace(/\D/g, '').trim();
      
      // Create different phone number formats to try
      const phoneFormats = [
        cleanPhone,                    // Original format
        cleanPhone.replace(/^20/, ''), // Without country code if it starts with 20
        `20${cleanPhone}`,            // With country code
        `0${cleanPhone.replace(/^20/, '')}` // With leading 0
      ];

      logger.info('Trying phone formats:', {
        original: phone,
        formats: phoneFormats
      });

      // Search in both customer phone and shipping_address phone
      const response = await this.client.get({
        path: 'orders',
        query: {
          status: 'any',
          fields: 'id,name,created_at,tags,customer,shipping_address,customer.phone',
          limit: 20, // Increased limit to find more potential matches
          order: 'created_at desc' // Get most recent orders first
        }
      });

      const orders = response.body.orders as ShopifyOrder[];
      
      // Filter orders where customer phone or shipping address phone matches any format
      const matchingOrders = orders.filter(order => {
        const shippingPhone = order.shipping_address?.phone?.replace(/\D/g, '').trim() || '';
        const customerPhone = order.customer?.phone?.replace(/\D/g, '').trim() || '';
        
        // Log each order's phone numbers for debugging
        logger.info('Checking order phones:', {
          orderId: order.id,
          orderName: order.name,
          shippingPhone,
          customerPhone,
          formats: phoneFormats
        });

        // Check if any of our phone formats match either phone
        return phoneFormats.some(format => {
          const formattedPhone = format.replace(/\D/g, '').trim();
          const shippingMatches = shippingPhone && shippingPhone.includes(formattedPhone);
          const customerMatches = customerPhone && customerPhone.includes(formattedPhone);
          const matches = shippingMatches || customerMatches;
          
          // Log each comparison for debugging
          if (matches) {
            logger.info('Phone match found:', {
            orderId: order.id,
              orderName: order.name,
            shippingPhone,
              customerPhone,
            formatTried: format,
            formattedPhone,
              shippingMatches,
              customerMatches
          });
          }

          return matches;
        });
      });

      logger.info('Found orders by phone:', {
        matchCount: matchingOrders.length,
        orderIds: matchingOrders.map(o => o.id),
        tags: matchingOrders.map(o => o.tags)
      });

      return matchingOrders;
    } catch (error) {
      logger.error('Error getting orders by phone:', error);
      throw error;
    }
  }
}

export const shopifyService = new ShopifyService();

export const updateOrderStatus = async (orderId: number, tags: string[]): Promise<void> => {
  const shopifyService = new ShopifyService();
  await shopifyService.updateOrderTags(orderId.toString(), tags);
};

export const addLocationTags = async (orderId: number, cityId: string, neighborhoodId: string, subZoneId: string): Promise<void> => {
  const shopifyService = new ShopifyService();
  const tags = [
    `mylerz_city_id:${cityId}`,
    `mylerz_neighborhood_id:${neighborhoodId}`,
    `mylerz_subzone_id:${subZoneId}`
  ];
  await shopifyService.updateOrderTags(orderId.toString(), tags);
}; 

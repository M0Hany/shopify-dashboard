import '@shopify/shopify-api/adapters/node';
import { shopifyApi, ApiVersion, Session, RequestReturn } from '@shopify/shopify-api';
import config from '../config/server';

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
  custom_due_date?: string;
  line_items: {
    title: string;
    quantity: number;
    price: string;
    variant_title: string | null;
  }[];
  customer: {
    id: number;
    first_name: string;
    last_name: string;
    phone: string;
  };
  shipping_address: {
    phone: string;
  };
}

// Initialize Shopify API client
const shopify = shopifyApi({
  apiSecretKey: config.shopify.apiSecret,
  adminApiAccessToken: config.shopify.accessToken,
  apiVersion: ApiVersion.October23,
  hostName: config.shopify.storeUrl,
  isEmbeddedApp: false,
  isCustomStoreApp: true,
  scopes: [
    'read_orders',
    'write_orders',
    'read_fulfillments',
    'write_fulfillments',
    'read_customers',
    'write_customers',
    'read_tags',
    'write_tags'
  ],
});

export class ShopifyService {
  private client: InstanceType<typeof shopify.clients.Rest>;
  private session: Session;

  constructor() {
    this.session = new Session({
      id: `offline_${config.shopify.storeUrl}`,
      shop: config.shopify.storeUrl,
      state: 'state',
      isOnline: false,
      accessToken: config.shopify.accessToken,
    });
    this.client = new shopify.clients.Rest({
      session: this.session,
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
      console.error('Error fetching customer details:', error);
      throw new Error('Failed to fetch customer details from Shopify');
    }
  }

  async getOrders(params: {
    limit?: number;
    status?: string;
    created_at_min?: string;
    created_at_max?: string;
  }): Promise<ShopifyOrder[]> {
    try {
      const allOrders: ShopifyOrder[] = [];
      let hasNextPage = true;
      let pageInfo = '';

      while (hasNextPage) {
        const query: Record<string, string | number> = {
          limit: params.limit ? Math.min(250, params.limit - allOrders.length) : 250,
          status: 'any',
          fields: 'id,name,email,phone,total_price,financial_status,fulfillment_status,tags,created_at,updated_at,line_items,customer,shipping_address,line_items.variant_title,note'
        };

        if (params.status) query.status = params.status;
        if (params.created_at_min) query.created_at_min = params.created_at_min;
        if (params.created_at_max) query.created_at_max = params.created_at_max;
        if (pageInfo) query.page_info = pageInfo;

        const response = await this.client.get({
          path: '/admin/api/2022-10/orders.json',
          query,
        }) as unknown as RequestReturn<{ orders?: ShopifyOrder[] }>;

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
                console.error(`Failed to fetch details for customer ${order.customer.id}:`, error);
                return order;
              }
            }
            return order;
          })
        );

        allOrders.push(...ordersWithCustomerDetails);

        // Stop if we've reached the limit
        if (params.limit && allOrders.length >= params.limit) {
          return allOrders.slice(0, params.limit);
        }

        const linkHeader = response.headers['link'] as string;
        if (linkHeader) {
          const nextPageMatch = linkHeader.match(/<([^>]+)>; rel="next"/);
          hasNextPage = !!nextPageMatch;
          if (nextPageMatch) {
            const nextPageUrl = new URL(nextPageMatch[1]);
            pageInfo = nextPageUrl.searchParams.get('page_info') || '';
          }
        } else {
          hasNextPage = false;
        }
      }

      return allOrders;
    } catch (error: any) {
      console.error('Error fetching orders:', {
        error,
        storeUrl: config.shopify.storeUrl,
        customDomain: '007j3b-hp.com',
        hasAccessToken: true,
        errorDetails: error.response?.body || error.message,
        requestUrl: error.response?.url,
      });
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

  async updateOrderStatus(orderId: number, status: string): Promise<void> {
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
      
      // Filter out existing status tags and shipping date tag
      const statusTags = ['customer_confirmed', 'ready to ship', 'shipped', 'fulfilled', 'cancelled'].map(tag => tag.trim());
      const filteredTags = existingTags.filter((tag: string) => 
        !statusTags.includes(tag.trim()) &&
        !tag.startsWith('shipping_date:')
      );

      // Add new status tag if not pending (ensure it's trimmed)
      if (status !== 'pending') {
        filteredTags.push(status.trim());
      }

      // If status is shipped, add shipping date tag
      if (status === 'shipped') {
        const today = new Date();
        const shippingDate = today.toISOString().split('T')[0]; // Get only YYYY-MM-DD
        filteredTags.push(`shipping_date:${shippingDate}`);
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
      const statusTags = ['customer_confirmed', 'ready to ship', 'shipped', 'express', 'overdue'];
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
    } catch (error) {
      console.error('Error fulfilling order:', {
        error,
        orderId: id,
        errorDetails: error.response?.body || error.message,
        requestUrl: error.response?.url
      });
      throw new Error(`Failed to fulfill order in Shopify: ${error.message}`);
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
}

export const shopifyService = new ShopifyService(); 
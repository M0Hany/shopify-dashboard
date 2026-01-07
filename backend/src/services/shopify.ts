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
  note?: string | null; // Order note from Shopify
  line_items: {
    title: string;
    quantity: number;
    price: string;
    variant_title: string | null;
    product_id?: number;
    variant_id?: number;
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
  shipping_lines?: Array<{
    price: string;
    title?: string;
  }>;
  total_shipping_price_set?: {
    shop_money: {
      amount: string;
      currency_code: string;
    };
  };
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
  private graphqlClient: InstanceType<typeof shopify.clients.Graphql>;
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

    this.graphqlClient = new shopify.clients.Graphql({
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

  /**
   * Get orders using GraphQL API with cursor-based pagination
   */
  async getOrders(params: {
    limit?: number;
    status?: string;
    created_at_min?: string;
    created_at_max?: string;
    excluded_tags?: string;
  }): Promise<ShopifyOrder[]> {
    try {
      const allOrders: ShopifyOrder[] = [];
      const seenOrderIds = new Set<number>(); // Track order IDs to prevent duplicates
      let cursor: string | null = null;
      let hasNextPage = true;
      let pageCount = 0;
      const MAX_PAGES = 50; // Safety limit to prevent infinite loops

      logger.info(`[getOrders GraphQL] Starting to fetch orders. Has limit: ${!!params.limit}, limit value: ${params.limit}`);

      // Build query string for filtering
      let queryString = 'status:any';
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
          queryString = `tag:${tag}`;
        }
      }

      if (params.excluded_tags) {
        const excludedTagsList = params.excluded_tags
          .split(',')
          .map(tag => tag.trim())
          .filter(tag => tag);
        if (excludedTagsList.length > 0) {
          const tagFilter = excludedTagsList.map(tag => `NOT tag:${tag}`).join(' AND ');
          queryString = queryString !== 'status:any' ? `${queryString} AND ${tagFilter}` : tagFilter;
        }
      }

      if (params.created_at_min) {
        queryString += ` AND created_at:>='${params.created_at_min}'`;
      }
      if (params.created_at_max) {
        queryString += ` AND created_at:<='${params.created_at_max}'`;
      }

      while (hasNextPage && pageCount < MAX_PAGES) {
        pageCount++;
        
        const limit = params.limit 
          ? Math.min(250, params.limit - allOrders.length) 
          : 250;

        logger.info(`[getOrders GraphQL] Page ${pageCount}: Fetching orders${cursor ? ` with cursor` : ' (first page)'}`);

        // Escape query string for GraphQL (escape quotes and backslashes)
        const escapedQueryString = queryString
          .replace(/\\/g, '\\\\')  // Escape backslashes first
          .replace(/"/g, '\\"')     // Escape double quotes
          .replace(/\n/g, '\\n')    // Escape newlines
          .replace(/\r/g, '\\r');  // Escape carriage returns

        // Escape cursor if it exists
        const escapedCursor = cursor ? cursor.replace(/\\/g, '\\\\').replace(/"/g, '\\"') : null;

        // Build the GraphQL query with variables inline (Shopify GraphQL client expects string)
        // Note: cursor is optional, so we only include it if it exists
        const graphqlQuery = `
          query GetOrders {
            orders(first: ${limit}${escapedCursor ? `, after: "${escapedCursor}"` : ''}, query: "${escapedQueryString}") {
              edges {
                cursor
                node {
                  id
                  name
                  email
                  phone
                  createdAt
                  updatedAt
                  processedAt
                  displayFinancialStatus
                  displayFulfillmentStatus
                  tags
                  note
                  totalPriceSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                  subtotalPriceSet {
                    shopMoney {
                      amount
                    }
                  }
                  totalTaxSet {
                    shopMoney {
                      amount
                    }
                  }
                  totalShippingPriceSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                  paymentGatewayNames
                  lineItems(first: 250) {
                    edges {
                      node {
                        title
                        quantity
                        originalUnitPriceSet {
                          shopMoney {
                            amount
                          }
                        }
                        variant {
                          id
                          title
                          product {
                            id
                          }
                        }
                        customAttributes {
                          key
                          value
                        }
                      }
                    }
                  }
                  customer {
                    id
                    firstName
                    lastName
                    email
                    phone
                    defaultAddress {
                      phone
                    }
                  }
                  shippingAddress {
                    phone
                    address1
                    address2
                    city
                    province
                    zip
                    country
                  }
                  fulfillments(first: 10) {
                    id
                    status
                    trackingInfo {
                      company
                      number
                    }
                    createdAt
                    updatedAt
                  }
                  shippingLines(first: 10) {
                    edges {
                      node {
                        title
                        originalPriceSet {
                          shopMoney {
                            amount
                          }
                        }
                      }
                    }
                  }
                }
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        `;

        // Log the query for debugging (truncated for readability)
        logger.debug(`[getOrders GraphQL] Page ${pageCount}: Query (first 500 chars):`, graphqlQuery.substring(0, 500));

        let response: any;
        let responseBody: any;
        
        try {
          response = await this.graphqlClient.query({
            data: graphqlQuery
          }) as any;

          // Shopify GraphQL client wraps response in body
          responseBody = response.body as any;
        } catch (error: any) {
          // Log the full query on error for debugging
          logger.error(`[getOrders GraphQL] Page ${pageCount}: GraphQL query error. Full query:`, graphqlQuery);
          logger.error(`[getOrders GraphQL] Page ${pageCount}: Error details:`, error);
          
          // If it's a 400 error, log the response body if available
          if (error.response?.body) {
            logger.error(`[getOrders GraphQL] Page ${pageCount}: Response body:`, JSON.stringify(error.response.body, null, 2));
          }
          
          // Check for GraphQL errors in the response
          if (error.body?.errors) {
            logger.error(`[getOrders GraphQL] Page ${pageCount}: GraphQL errors:`, JSON.stringify(error.body.errors, null, 2));
          }
          
          throw new Error(`GraphQL query failed: ${error.message || 'Unknown error'}`);
        }

        // Check for GraphQL errors in response body
        if (responseBody.errors) {
          logger.error(`[getOrders GraphQL] Page ${pageCount}: GraphQL errors in response:`, JSON.stringify(responseBody.errors, null, 2));
          throw new Error(`GraphQL errors: ${responseBody.errors.map((e: any) => e.message).join(', ')}`);
        }

        // Check for rate limiting
        if (responseBody.extensions?.cost) {
          const cost = responseBody.extensions.cost;
          const throttleStatus = cost.throttleStatus;
          logger.info(`[getOrders GraphQL] Page ${pageCount}: Query cost: ${cost.requestedQueryCost}, Available: ${throttleStatus.currentlyAvailable}, Restore rate: ${throttleStatus.restoreRate}`);
          
          // If we're running low on available cost, add a small delay
          if (throttleStatus.currentlyAvailable < 100) {
            logger.warn(`[getOrders GraphQL] Page ${pageCount}: Low available cost. Adding delay...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        if (!responseBody.data?.orders?.edges) {
          logger.error(`[getOrders GraphQL] Page ${pageCount}: Invalid response structure:`, JSON.stringify(responseBody).substring(0, 500));
          throw new Error('No orders found in GraphQL response');
        }

        const edges = responseBody.data.orders.edges;
        const pageInfo = responseBody.data.orders.pageInfo;

        // Transform GraphQL response to match ShopifyOrder interface
        const transformedOrders: ShopifyOrder[] = edges.map((edge: any) => {
          const node = edge.node;
          
          // Extract numeric ID from GID (e.g., "gid://shopify/Order/123456" -> 123456)
          const orderId = parseInt(node.id.split('/').pop() || '0', 10);
          
          // Transform line items
          const lineItems = node.lineItems.edges.map((itemEdge: any) => {
            const item = itemEdge.node;
            return {
              title: item.title,
              quantity: item.quantity,
              price: item.originalUnitPriceSet?.shopMoney?.amount || '0',
              variant_title: item.variant?.title || null,
              product_id: item.variant?.product?.id ? parseInt(item.variant.product.id.split('/').pop() || '0', 10) : undefined,
              variant_id: item.variant?.id ? parseInt(item.variant.id.split('/').pop() || '0', 10) : undefined,
              properties: item.customAttributes?.map((attr: any) => ({
                name: attr.key || attr.name, // Shopify GraphQL uses 'key' but we map to 'name' for compatibility
                value: attr.value
              })) || []
            };
          });

          // Transform fulfillments
          const fulfillments = node.fulfillments?.map((fulfillment: any) => ({
            id: parseInt(fulfillment.id.split('/').pop() || '0', 10),
            status: fulfillment.status,
            shipment_status: fulfillment.status, // shipmentStatus deprecated, use status instead
            tracking_company: fulfillment.trackingInfo?.[0]?.company,
            tracking_number: fulfillment.trackingInfo?.[0]?.number,
            created_at: fulfillment.createdAt,
            updated_at: fulfillment.updatedAt
          })) || [];

          // Transform shipping lines (connection type with edges/node structure)
          const shippingLines = node.shippingLines?.edges?.map((edge: any) => {
            const line = edge.node;
            return {
              price: line.originalPriceSet?.shopMoney?.amount || '0',
              title: line.title
            };
          }) || [];

          // Transform customer
          const customerId = node.customer?.id ? parseInt(node.customer.id.split('/').pop() || '0', 10) : undefined;

          // Transform tags (GraphQL returns as array)
          const tags = node.tags || [];

          return {
            id: orderId,
            name: node.name,
            email: node.email || '',
            phone: node.phone || node.customer?.phone || node.shippingAddress?.phone || '',
            total_price: node.totalPriceSet?.shopMoney?.amount || '0',
            financial_status: node.displayFinancialStatus || '',
            fulfillment_status: node.displayFulfillmentStatus || '',
            tags: tags,
            created_at: node.createdAt,
            updated_at: node.updatedAt,
            payment_gateway_names: node.paymentGatewayNames || [],
            note: node.note || null, // Include note field
            line_items: lineItems,
            customer: customerId ? {
              id: customerId,
              first_name: node.customer.firstName || '',
              last_name: node.customer.lastName || '',
              phone: node.customer.phone || node.customer.defaultAddress?.phone || ''
            } : {
              id: 0,
              first_name: '',
              last_name: '',
              phone: node.shippingAddress?.phone || ''
            },
            shipping_address: {
              phone: node.shippingAddress?.phone || '',
              address1: node.shippingAddress?.address1 || '',
              address2: node.shippingAddress?.address2 || '',
              city: node.shippingAddress?.city || '',
              province: node.shippingAddress?.province || '',
              zip: node.shippingAddress?.zip || '',
              country: node.shippingAddress?.country || ''
            },
            fulfillments: fulfillments,
            shipping_lines: shippingLines,
            total_shipping_price_set: node.totalShippingPriceSet ? {
              shop_money: {
                amount: node.totalShippingPriceSet.shopMoney.amount,
                currency_code: node.totalShippingPriceSet.shopMoney.currencyCode
              }
            } : undefined
          };
        });

        // Deduplicate orders by ID before adding to allOrders
        const newOrders = transformedOrders.filter(order => {
          if (seenOrderIds.has(order.id)) {
            logger.warn(`[getOrders GraphQL] Page ${pageCount}: Duplicate order detected: ${order.id} (${order.name}). Skipping.`);
            return false;
          }
          seenOrderIds.add(order.id);
          return true;
        });

        allOrders.push(...newOrders);

        logger.info(`[getOrders GraphQL] Page ${pageCount}: Fetched ${transformedOrders.length} orders, ${newOrders.length} new (${transformedOrders.length - newOrders.length} duplicates skipped). Total so far: ${allOrders.length}`);

        // Check if there are more pages
        hasNextPage = pageInfo.hasNextPage;
        if (hasNextPage && edges.length > 0) {
          cursor = edges[edges.length - 1].cursor;
          logger.info(`[getOrders GraphQL] Page ${pageCount}: Continuing to next page. Cursor: ${cursor.substring(0, 30)}...`);
        } else {
          logger.info(`[getOrders GraphQL] Page ${pageCount}: No more pages. hasNextPage: ${pageInfo.hasNextPage}`);
        }

        // If we've reached the requested limit, stop fetching
        if (params.limit && allOrders.length >= params.limit) {
          logger.info(`[getOrders GraphQL] Reached requested limit of ${params.limit}. Stopping pagination.`);
          hasNextPage = false;
          allOrders.splice(params.limit); // Trim to exact limit
        }

        // Additional safety: if we got 0 orders, definitely stop
        if (transformedOrders.length === 0) {
          logger.info(`[getOrders GraphQL] Page ${pageCount}: Received 0 orders. This is the last page.`);
          hasNextPage = false;
        }
      }

      if (pageCount >= MAX_PAGES) {
        logger.error(`[getOrders GraphQL] Reached MAX_PAGES limit (${MAX_PAGES}). Stopping to prevent infinite loop.`);
        console.error(`[getOrders GraphQL] WARNING: Pagination stopped at ${MAX_PAGES} pages. This may indicate a pagination bug.`);
      }
      
      logger.info(`[getOrders GraphQL] Finished fetching. Total orders: ${allOrders.length}, Pages fetched: ${pageCount}, Unique orders: ${seenOrderIds.size}`);
      console.log(`[getOrders GraphQL] Total orders fetched: ${allOrders.length} from ${pageCount} pages`);
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
        const statusTags = ['order_ready', 'customer_confirmed', 'ready_to_ship', 'ready-to-ship', 'shipped', 'fulfilled', 'cancelled', 'on_hold'];
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
      
      // Parse status string - it might contain additional tags like "fulfilled,fulfillment_date:2026-01-01"
      const statusParts = status.split(',').map(s => s.trim());
      const actualStatus = statusParts[0]; // First part is the status
      const additionalTags = statusParts.slice(1); // Rest are additional tags

      // Filter out existing status tags and shipping date tag (case-insensitive)
      const statusTags = ['order_ready', 'customer_confirmed', 'ready_to_ship', 'ready-to-ship', 'shipped', 'fulfilled', 'cancelled', 'on_hold'].map(tag => tag.trim().toLowerCase());
      const filteredTags = existingTags.filter((tag: string) => {
        const trimmed = tag.trim().toLowerCase();
        return !statusTags.includes(trimmed) && 
               !tag.trim().startsWith('shipping_date:') &&
               !tag.trim().startsWith('fulfilled_at:') &&
               !tag.trim().startsWith('fulfillment_date:');
      });

      // Add new status tag if not pending (ensure it's trimmed)
      const trimmedStatus = actualStatus.trim().toLowerCase();
      if (trimmedStatus !== 'pending') {
        filteredTags.push(actualStatus.trim());
      }

      // Add any additional tags from the status string (like fulfillment_date:)
      additionalTags.forEach(tag => {
        if (tag && tag.trim()) {
          filteredTags.push(tag.trim());
        }
      });

      // If moving from ready_to_ship (or ready-to-ship) to shipped, add shipping date tag
      const normalizedPreviousStatus = previousStatus.trim().toLowerCase();
      const normalizedNewStatus = actualStatus.trim().toLowerCase();
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
      if (actualStatus.trim() === 'fulfilled' || actualStatus.trim() === 'cancelled') {
        const priorityIndex = filteredTags.findIndex(tag => tag.trim() === 'priority');
        if (priorityIndex > -1) {
          filteredTags.splice(priorityIndex, 1);
        }
      }

      // Add fulfilled_at date tag when order is fulfilled
      if (actualStatus.trim().toLowerCase() === 'fulfilled') {
        // Check if fulfilled_at or fulfillment_date tag already exists (from additional tags or existing)
        const existingFulfilledAtTag = filteredTags.find(tag => 
          tag.trim().startsWith('fulfilled_at:') || tag.trim().startsWith('fulfillment_date:')
        );
        if (!existingFulfilledAtTag) {
          const today = new Date();
          const fulfilledDate = today.toISOString().split('T')[0]; // Get only YYYY-MM-DD
          const fulfilledAtTag = `fulfilled_at:${fulfilledDate}`;
          filteredTags.push(fulfilledAtTag);
          logger.info('Added fulfilled_at tag', {
            orderId,
            fulfilledDate,
            fulfilledAtTag,
          });
        }

        // Check if order is a pickup order - automatically mark as paid with 0 shipping cost
        const isPickup = existingTags.some((tag: string) => 
          tag.trim().toLowerCase().startsWith('shipping_method:') && 
          tag.trim().toLowerCase().includes('pickup')
        ) || filteredTags.some((tag: string) => 
          tag.trim().toLowerCase().startsWith('shipping_method:') && 
          tag.trim().toLowerCase().includes('pickup')
        );

        if (isPickup) {
          // Remove any existing paid and paid_date tags
          const paidTagIndex = filteredTags.findIndex(tag => tag.trim() === 'paid');
          if (paidTagIndex > -1) {
            filteredTags.splice(paidTagIndex, 1);
          }
          const paidDateTagIndex = filteredTags.findIndex(tag => tag.trim().startsWith('paid_date:'));
          if (paidDateTagIndex > -1) {
            filteredTags.splice(paidDateTagIndex, 1);
          }

          // Add paid and paid_date tags for pickup orders
          const today = new Date();
          const paidDate = today.toISOString().split('T')[0]; // Get only YYYY-MM-DD
          filteredTags.push('paid');
          filteredTags.push(`paid_date:${paidDate}`);
          logger.info('Added paid and paid_date tags for pickup order', {
            orderId,
            paidDate,
          });
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

// REMOVED: Mylerz-specific location tags function (no longer used)
// export const addLocationTags = async (orderId: number, cityId: string, neighborhoodId: string, subZoneId: string): Promise<void> => {
//   DEPRECATED - Mylerz removed
// }; 

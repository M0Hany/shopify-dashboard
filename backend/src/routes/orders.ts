import express, { Request, Response } from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import { ShopifyService } from '../services/shopify';
import { logger } from '../utils/logger';
import { addLocationTags } from '../services/shopify';
import { shopifyService } from '../services/shopify';
import { OrderConfirmationService } from '../services/orderConfirmation.service';
import { WhatsAppService } from '../services/whatsapp';
import { AxiosError } from 'axios';
import { discordNotificationService } from '../services/discordNotifications';

const router = express.Router();
const shopifyServiceInstance = new ShopifyService();
const orderConfirmationService = OrderConfirmationService.getInstance();

// Configure multer for file upload
const upload = multer({ storage: multer.memoryStorage() });

// Get all orders with optional filters
router.get('/', async (req: Request, res: Response) => {
  try {
    // Disable caching for dynamic orders data to ensure fresh responses
    res.set({
      'Cache-Control': 'no-store'
    });

    const orders = await shopifyServiceInstance.getOrders({
      limit: 250,
      status: req.query.status as string,
      created_at_min: req.query.created_at_min as string,
      created_at_max: req.query.created_at_max as string,
    });
    res.json(orders);
  } catch (error) {
    logger.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get a single order by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const order = await shopifyServiceInstance.getOrder(Number(req.params.id));
    res.json(order);
  } catch (error) {
    logger.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Helper function to determine current status from tags
function getCurrentStatusFromTags(tags: string[] | string | null | undefined): string {
  if (!tags) return 'pending';
  
  const tagArray = Array.isArray(tags)
    ? tags.map((t: string) => t.trim().toLowerCase())
    : typeof tags === 'string'
      ? tags.split(',').map((t: string) => t.trim().toLowerCase())
      : [];

  if (tagArray.includes('cancelled')) return 'cancelled';
  if (tagArray.includes('paid')) return 'paid';
  if (tagArray.includes('fulfilled')) return 'fulfilled';
  if (tagArray.includes('shipped')) return 'shipped';
  if (tagArray.includes('ready_to_ship')) return 'ready_to_ship';
  if (tagArray.includes('customer_confirmed')) return 'customer_confirmed';
  if (tagArray.includes('order_ready')) return 'order_ready';
  return 'pending';
}

// Bulk update order status
router.put('/bulk/status', async (req: Request, res: Response) => {
  try {
    const { orderIds, status } = req.body;
    
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ error: 'orderIds must be a non-empty array' });
    }
    
    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }
    
    // Normalize incoming status values (trimmed and case-insensitive)
    let normalizedStatus: string = status.toString().trim();
    const statusLower = normalizedStatus.toLowerCase();
    if (statusLower === 'confirmed') normalizedStatus = 'customer_confirmed';
    else if (statusLower === 'fulfill') normalizedStatus = 'fulfilled';
    else if (statusLower === 'order-ready') normalizedStatus = 'order_ready';
    
    const results = {
      successful: [] as number[],
      failed: [] as Array<{ orderId: number; error: string }>
    };
    
    // Get all orders before update to determine previous statuses
    const ordersBefore = await Promise.allSettled(
      orderIds.map((id: number) => shopifyServiceInstance.getOrder(Number(id)))
    );
    
    // Determine previous status (use first successful order's status as reference)
    let previousStatus = 'pending';
    const successfulOrdersBefore = ordersBefore
      .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
      .map(result => result.value);
    
    if (successfulOrdersBefore.length > 0) {
      previousStatus = getCurrentStatusFromTags(successfulOrdersBefore[0].tags);
    }
    
    const orderNames: string[] = [];
    
    // Update each order
    for (let i = 0; i < orderIds.length; i++) {
      const orderId = Number(orderIds[i]);
      const orderBeforeResult = ordersBefore[i];
      
      try {
        await shopifyServiceInstance.updateOrderStatus(orderId, normalizedStatus);
        results.successful.push(orderId);
        
        // Get order name for notification (if we successfully fetched it before)
        if (orderBeforeResult.status === 'fulfilled') {
          orderNames.push(orderBeforeResult.value.name);
        }
      } catch (error: any) {
        results.failed.push({
          orderId,
          error: error.message || 'Unknown error'
        });
      }
    }
    
    // Send bulk Discord notification if any orders were successfully updated
    if (results.successful.length > 0 && orderNames.length > 0) {
      discordNotificationService.notifyBulkStatusChange({
        orderCount: results.successful.length,
        previousStatus,
        newStatus: normalizedStatus,
        orderNames
      }).catch(err => {
        logger.error('Failed to send Discord bulk notification', err);
      });
    }
    
    res.json({
      success: true,
      successful: results.successful.length,
      failed: results.failed.length,
      details: results
    });
  } catch (error) {
    logger.error('Error bulk updating order status:', error);
    res.status(500).json({ error: 'Failed to bulk update order status' });
  }
});

// Update order status
router.put('/:id/status', async (req: Request, res: Response) => {
  try {
    const orderId = Number(req.params.id);
    
    // Get order before update to determine previous status
    const orderBefore = await shopifyServiceInstance.getOrder(orderId);
    const previousStatus = getCurrentStatusFromTags(orderBefore.tags);
    
    // Normalize incoming status values from frontend (trimmed and case-insensitive)
    let status: string = (req.body.status || '').toString().trim();
    const statusLower = status.toLowerCase();
    if (statusLower === 'confirmed') status = 'customer_confirmed';
    else if (statusLower === 'fulfill') status = 'fulfilled';
    else if (statusLower === 'order-ready') status = 'order_ready';
    
    // Update the order status
    await shopifyServiceInstance.updateOrderStatus(orderId, status);
    
    // Get updated order for notification
    const orderAfter = await shopifyServiceInstance.getOrder(orderId);
    
    // Send Discord notification (non-blocking)
    discordNotificationService.notifyOrderStatusChange({
      orderId: orderAfter.id,
      orderName: orderAfter.name,
      customerName: `${orderAfter.customer?.first_name || ''} ${orderAfter.customer?.last_name || ''}`.trim() || 'N/A',
      previousStatus,
      newStatus: status
    }).catch(err => {
      logger.error('Failed to send Discord notification', err);
      // Don't fail the request if notification fails
    });
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// Update order due date
router.put('/:id/due-date', async (req: Request, res: Response) => {
  try {
    await shopifyServiceInstance.updateOrderDueDate(Number(req.params.id), req.body.custom_due_date);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating order due date:', error);
    res.status(500).json({ error: 'Failed to update order due date' });
  }
});

// Update order start date
router.put('/:id/start-date', async (req: Request, res: Response) => {
  try {
    logger.info('Received start-date update request:', {
      orderId: req.params.id,
      customStartDate: req.body.custom_start_date,
      body: req.body
    });
    await shopifyServiceInstance.updateOrderStartDate(Number(req.params.id), req.body.custom_start_date);
    logger.info('Start date update successful');
    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating order start date:', error);
    res.status(500).json({ error: 'Failed to update order start date' });
  }
});

// Update order note
router.put('/:id/note', async (req: Request, res: Response) => {
  try {
    await shopifyServiceInstance.updateOrderNote(Number(req.params.id), req.body.note);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating order note:', error);
    res.status(500).json({ error: 'Failed to update order note' });
  }
});

// Update order priority
router.put('/:id/priority', async (req: Request, res: Response) => {
  try {
    await shopifyServiceInstance.updateOrderPriority(Number(req.params.id), req.body.isPriority);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating order priority:', error);
    res.status(500).json({ error: 'Failed to update order priority' });
  }
});

// Fulfill an order
router.post('/:id/fulfill', async (req: Request, res: Response) => {
  try {
    await shopifyServiceInstance.fulfillOrder(Number(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Error fulfilling order:', {
      error,
      orderId: req.params.id,
      errorDetails: error.response?.body || error.message,
      requestUrl: error.response?.url
    });
    res.status(500).json({ 
      error: 'Failed to fulfill order',
      details: error.message,
      orderId: req.params.id
    });
  }
});

// Upload Excel file for paid orders
router.post('/upload-paid-orders', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Read the Excel file
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const worksheet = workbook.Sheets['Transferred'];
    
    if (!worksheet) {
      return res.status(400).json({ error: 'Sheet "Transferred" not found in the Excel file' });
    }

    // Convert to JSON with type assertion for array of arrays
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    // Skip first three rows (title, empty, headers) and process until "Totals" row
    const validRows = [];
    for (let i = 3; i < data.length; i++) {
      const row = data[i];
      
      // Stop processing when we hit the Totals row
      if (row[0] && row[0].toString().trim().startsWith('Totals')) {
        break;
      }

      // Skip empty rows or rows without barcode
      if (!row || !row.length) {
        continue;
      }

      // Validate barcode (column A, index 0)
      if (!row[0]) {
        continue;
      }

      validRows.push(row);
    }

    const results = {
      processed: 0,
      updated: 0,
      notFound: 0,
      errors: 0,
      failedTransfers: [] as Array<{
        customerName: string;
        customerPhone: string;
        reason: string;
      }>
    };

    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];

    // Process each valid row
    for (const row of validRows) {
      try {
        // Get barcode from column A (index 0)
        const barcode = row[0]?.toString().trim();
        
        if (!barcode) {
          results.errors++;
          results.failedTransfers.push({
            customerName: 'N/A',
            customerPhone: 'N/A',
            reason: 'No barcode found in column A'
          });
          continue;
        }

        // Find matching order by barcode
        const matchingOrder = await shopifyServiceInstance.findOrderByBarcode(barcode);
        
        if (matchingOrder) {
          // Use current date for payment_date tag
          const paymentDateTag = `payment_date:${formattedDate}`.trim();
          
          try {
            // Update order with paid status and payment date
            await shopifyServiceInstance.updateOrderStatus(matchingOrder.id, 'paid');
            await shopifyServiceInstance.addOrderTag(matchingOrder.id, paymentDateTag);
            
            results.updated++;
          } catch (updateError) {
            results.errors++;
            results.failedTransfers.push({
              customerName: matchingOrder.customer?.first_name || 'N/A',
              customerPhone: matchingOrder.customer?.phone || 'N/A',
              reason: 'Failed to update order status'
            });
            logger.error('Error updating order status:', updateError);
          }
        } else {
          results.notFound++;
          results.failedTransfers.push({
            customerName: 'N/A',
            customerPhone: 'N/A',
            reason: `Order not found for barcode: ${barcode}`
          });
        }
        
        results.processed++;
      } catch (error) {
        logger.error('Error processing row:', error);
        results.errors++;
      }
    }

    res.json(results);
  } catch (error) {
    logger.error('Error processing Excel file:', error);
    res.status(500).json({ error: 'Failed to process Excel file' });
  }
});

router.post('/bulk-add-address-tags', async (req, res) => {
  try {
    const { orders } = req.body;
    
    if (!Array.isArray(orders)) {
      logger.error('Invalid request: orders is not an array');
      return res.status(400).json({ error: 'Orders must be an array' });
    }

    logger.info(`Received request to add address tags to ${orders.length} orders`);

    const results = {
      successful: [] as string[],
      failed: [] as string[],
      errors: {} as Record<string, string>
    };

    for (const order of orders) {
      try {
        if (!order.id || !order.shipping_address?.city) {
          throw new Error('Missing required order data');
        }

        // Extract location IDs from existing tags
        const cityIdMatch = order.tags?.find((tag: string) => tag.startsWith('mylerz_city_id:'))?.split(':')[1];
        const neighborhoodIdMatch = order.tags?.find((tag: string) => tag.startsWith('mylerz_neighborhood_id:'))?.split(':')[1];
        const subZoneIdMatch = order.tags?.find((tag: string) => tag.startsWith('mylerz_subzone_id:'))?.split(':')[1];

        if (!cityIdMatch || !neighborhoodIdMatch || !subZoneIdMatch) {
          throw new Error('Missing location IDs in tags');
        }

        await addLocationTags(
          Number(order.id),
          cityIdMatch,
          neighborhoodIdMatch,
          subZoneIdMatch
        );

        results.successful.push(order.id);
      } catch (error) {
        results.failed.push(order.id);
        results.errors[order.id] = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    res.json(results);
  } catch (error) {
    logger.error('Error processing bulk address tags:', error);
    res.status(500).json({ error: 'Failed to process bulk address tags' });
  }
});

// Update order tags
router.put('/:id/tags', async (req: Request, res: Response) => {
  try {
    const orderId = req.params.id;
    const newTags = req.body.tags;

    logger.info('Received tag update request:', {
      orderId,
      newTags,
      body: req.body,
      headers: req.headers
    });

    if (!Array.isArray(newTags)) {
      logger.error('Invalid tags format:', { newTags });
      return res.status(400).json({ error: 'Tags must be an array' });
    }

    await shopifyServiceInstance.updateOrderTags(orderId, newTags);
    
    logger.info('Tags update successful:', {
      orderId,
      newTags
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating order tags:', {
      error,
      orderId: req.params.id,
      body: req.body
    });
    res.status(500).json({ error: 'Failed to update order tags' });
  }
});

// Add location tags
router.post('/:orderId/location-tags', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { cityId, neighborhoodId, subZoneId } = req.body;

    if (!cityId || !neighborhoodId || !subZoneId) {
      res.status(400).json({ error: 'City ID, Neighborhood ID, and Sub-zone ID are required' });
      return;
    }

    await addLocationTags(Number(orderId), cityId, neighborhoodId, subZoneId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add location tags' });
  }
});

// Webhook for new orders
router.post('/webhook/order-created', async (req: Request, res: Response) => {
  try {
    const order = req.body;
    
    // Verify Shopify webhook
    const hmac = req.get('X-Shopify-Hmac-Sha256');
    const topic = req.get('X-Shopify-Topic');
    
    if (!hmac || topic !== 'orders/create') {
      logger.warn('Invalid webhook request', { hmac, topic });
      return res.sendStatus(401);
    }

    // Process the new order
    await orderConfirmationService.handleNewOrder(order);
    
    res.sendStatus(200);
  } catch (error) {
    logger.error('Error processing order webhook:', error);
    // Always return 200 to acknowledge webhook receipt
    res.sendStatus(200);
  }
});

export default router; 
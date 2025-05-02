import express from 'express';
import { shopifyService } from '../services/shopify';

interface ShopifyResponse<T> {
  body: {
    shop?: any;
    orders?: T[];
  };
}

const router = express.Router();

// Test endpoint to verify API connection
router.get('/test', async (req, res) => {
  try {
    // First try to get shop info to verify connection
    const shopResponse = await shopifyService.client.get({
      path: '/admin/api/2022-10/shop.json',
    }) as ShopifyResponse<any>;

    // Then try to get orders to verify permissions
    const ordersResponse = await shopifyService.client.get({
      path: '/admin/api/2022-10/orders.json',
      query: {},
    }) as ShopifyResponse<any>;

    res.json({
      shop: shopResponse.body.shop,
      orders: ordersResponse.body.orders,
      message: 'Successfully connected to Shopify API',
    });
  } catch (error: any) {
    console.error('Shopify API test failed:', error);
    res.status(500).json({ 
      error: 'Failed to connect to Shopify API',
      details: error.response?.body || error.message,
      requestUrl: error.response?.url,
    });
  }
});

// Get all orders with optional filters
router.get('/', async (req, res) => {
  try {
    const orders = await shopifyService.getOrders({
      status: 'any',
    });
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get a single order by ID
router.get('/:id', async (req, res) => {
  try {
    const order = await shopifyService.getOrder(Number(req.params.id));
    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Update order status
router.put('/:id/status', async (req, res) => {
  try {
    await shopifyService.updateOrderStatus(Number(req.params.id), req.body.status);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

router.put('/:id/due-date', async (req, res) => {
  try {
    const { id } = req.params;
    const { custom_due_date } = req.body;

    if (!custom_due_date) {
      return res.status(400).json({ error: 'Custom due date is required' });
    }

    // Update the order's custom due date
    await shopifyService.updateOrderDueDate(Number(id), custom_due_date);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating order due date:', error);
    res.status(500).json({ error: 'Failed to update order due date' });
  }
});

export default router; 
import express from 'express';
import { WhatsAppMonitor } from '../services/monitoring/WhatsAppMonitor';
import { WhatsAppService } from '../services/whatsapp';
import { logger } from '../utils/logger';
import { ShopifyService } from '../services/shopify';

const router = express.Router();
const whatsappService = new WhatsAppService();
const shopifyService = new ShopifyService();

// Test endpoint to send a message
router.post('/test-message', async (req, res) => {
  try {
    const { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    await whatsappService.sendTestMessage(phone);

    res.json({ success: true, message: 'Test message sent successfully' });
  } catch (error) {
    logger.error('Error sending test message:', error);
    res.status(500).json({ error: 'Failed to send test message' });
  }
});

// Send order ready notification
router.post('/order-ready', async (req, res) => {
  try {
    const { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    await whatsappService.sendOrderReady(phone);

    res.json({ success: true, message: 'Order ready notification sent successfully' });
  } catch (error) {
    logger.error('Error sending order ready notification:', error);
    res.status(500).json({ error: 'Failed to send order ready notification' });
  }
});

// Verify webhook
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  // Set this in your environment variables
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken) {
    logger.info('Webhook verified');
    res.status(200).send(challenge);
  } else {
    logger.warn('Webhook verification failed');
    res.sendStatus(403);
  }
});

// Handle webhook notifications
router.post('/webhook', express.json(), async (req, res) => {
  try {
    const { entry } = req.body;
    
    // Debug log the entire webhook payload
    logger.info('Received webhook payload:', {
      body: req.body,
      timestamp: new Date().toISOString()
    });

    for (const e of entry) {
      for (const change of e.changes) {
        // Handle message statuses
        if (change.value.messages) {
          for (const message of change.value.messages) {
            // Debug log each message
            logger.info('Processing message:', {
              messageType: message.type,
              messageId: message.id,
              from: message.from,
              timestamp: message.timestamp,
              button: message.button
            });

            // Log the exact button text if it exists
            if (message.button) {
              logger.info('Button details:', {
                text: message.button.text,
                payload: message.button.payload
              });
            }

            // Handle button responses - using exact text match
            if (message.type === 'button' && message.button) {
              const buttonText = message.button.text.trim();
              const expectedText = "Yes, I'll be available".trim();

              // Debug first three characters
              const buttonStart = buttonText.substring(0, 3);
              const expectedStart = expectedText.substring(0, 3);

              // Log each character separately
              logger.info('Character by character comparison:', {
                buttonFirstChars: {
                  asString: buttonStart,
                  asArray: [...buttonStart].map((c, i) => ({
                    char: c,
                    charCode: c.charCodeAt(0),
                    position: i
                  }))
                },
                expectedFirstChars: {
                  asString: expectedStart,
                  asArray: [...expectedStart].map((c, i) => ({
                    char: c,
                    charCode: c.charCodeAt(0),
                    position: i
                  }))
                },
                startMatches: buttonStart === expectedStart,
                timestamp: new Date().toISOString()
              });

              // Try matching just the start
              const matches = buttonStart === expectedStart;

              logger.info('Processing button message:', {
                buttonText,
                expectedText,
                matches,
                timestamp: new Date().toISOString()
              });

              if (matches) {
                // Get the customer's phone number
                const customerPhone = message.from;
                
                logger.info('Starting order search for customer:', {
                  phone: customerPhone,
                  messageId: message.id,
                  timestamp: new Date().toISOString()
                });

                try {
                  // Find the order by phone number
                  const orders = await shopifyService.getOrdersByPhone(customerPhone);
                  
                  logger.info('Found orders for customer:', {
                    phone: customerPhone,
                    orderCount: orders.length,
                    orders: orders.map(order => ({
                      id: order.id,
                      tags: order.tags,
                      shippingPhone: order.shipping_address?.phone
                    }))
                  });

                  if (orders.length === 0) {
                    logger.warn('No orders found for phone number', {
                      phone: customerPhone,
                      timestamp: new Date().toISOString()
                    });
                    return;
                  }

                  // Find the most recent order that has the order_ready_confirmed tag
                  // but doesn't have customer_confirmed tag
                  const targetOrder = orders.find(order => {
                    const tags = Array.isArray(order.tags) 
                      ? order.tags.map(t => t.trim())
                      : typeof order.tags === 'string'
                        ? order.tags.split(',').map(t => t.trim())
                        : [];
                    
                    const hasReadyTag = tags.includes('order_ready_confirmed');
                    const hasConfirmedTag = tags.includes('customer_confirmed');
                    
                    logger.info('Checking order tags:', {
                      orderId: order.id,
                      tags,
                      hasReadyTag,
                      hasConfirmedTag,
                      timestamp: new Date().toISOString()
                    });
                    
                    return hasReadyTag && !hasConfirmedTag;
                  });

                  if (targetOrder) {
                    logger.info('Found target order to update:', {
                      orderId: targetOrder.id,
                      currentTags: targetOrder.tags,
                      timestamp: new Date().toISOString()
                    });

                    // Add customer_confirmed tag
                    const currentTags = Array.isArray(targetOrder.tags) 
                      ? targetOrder.tags.map(t => t.trim())
                      : typeof targetOrder.tags === 'string'
                        ? targetOrder.tags.split(',').map(t => t.trim())
                        : [];

                    const newTags = [...currentTags, 'customer_confirmed'];
                    
                    logger.info('Updating order tags:', {
                      orderId: targetOrder.id,
                      oldTags: currentTags,
                      newTags,
                      timestamp: new Date().toISOString()
                    });

                    await shopifyService.updateOrderTags(targetOrder.id.toString(), newTags);

                    logger.info('Successfully updated order tags:', {
                      orderId: targetOrder.id,
                      phone: customerPhone,
                      newTags,
                      timestamp: new Date().toISOString()
                    });
                  } else {
                    logger.warn('No eligible order found for customer confirmation', {
                      phone: customerPhone,
                      orderCount: orders.length,
                      timestamp: new Date().toISOString()
                    });
                  }
                } catch (error) {
                  logger.error('Error processing customer confirmation', {
                    error,
                    phone: customerPhone,
                    timestamp: new Date().toISOString(),
                    stack: error instanceof Error ? error.stack : undefined
                  });
                }
              }
            }
          }
        }
      }
    }

    res.sendStatus(200);
  } catch (error) {
    logger.error('Error processing webhook:', error);
    res.sendStatus(500);
  }
});

export default router; 
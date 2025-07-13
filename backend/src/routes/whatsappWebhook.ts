import express from 'express';
import { WhatsAppMonitor } from '../services/monitoring/WhatsAppMonitor';
import { WhatsAppService } from '../services/whatsapp';
import { logger } from '../utils/logger';
import { ShopifyService } from '../services/shopify';

const router = express.Router();
const whatsappService = new WhatsAppService();
const shopifyService = new ShopifyService();

// In-memory storage for message ID to order number mapping
const messageOrderMap = new Map<string, string>();

// Helper method to store order number for a message
function storeOrderNumberForMessage(messageId: string, orderNumber: string): void {
  messageOrderMap.set(messageId, orderNumber);
  console.log('=== STORED ORDER NUMBER FOR MESSAGE ===');
  console.log('Message ID:', messageId);
  console.log('Order Number:', orderNumber);
  console.log('Total stored mappings:', messageOrderMap.size);
}

// Helper method to get order number for a message
function getOrderNumberForMessage(messageId: string): string | null {
  const orderNumber = messageOrderMap.get(messageId);
  console.log('=== RETRIEVING ORDER NUMBER FOR MESSAGE ===');
  console.log('Message ID:', messageId);
  console.log('Found Order Number:', orderNumber);
  
  // Remove the mapping after retrieval to save memory
  if (orderNumber) {
    messageOrderMap.delete(messageId);
    console.log('=== REMOVED MAPPING FROM MEMORY ===');
    console.log('Message ID:', messageId);
    console.log('Remaining mappings:', messageOrderMap.size);
  }
  
  return orderNumber || null;
}

// Helper method to update order with customer confirmation
async function updateOrderWithCustomerConfirmation(targetOrder: any, customerPhone: string): Promise<void> {
  logger.info('=== FOUND TARGET ORDER TO UPDATE ===', {
    orderId: targetOrder.id,
    orderName: targetOrder.name,
    currentTags: targetOrder.tags,
    timestamp: new Date().toISOString()
  });

  // Add customer_confirmed tag
  const currentTags = Array.isArray(targetOrder.tags) 
    ? targetOrder.tags.map((t: string) => t.trim())
    : typeof targetOrder.tags === 'string'
      ? targetOrder.tags.split(',').map((t: string) => t.trim())
      : [];

  const newTags = [...currentTags, 'customer_confirmed'];
  
  logger.info('=== UPDATING ORDER TAGS ===', {
    orderId: targetOrder.id,
    orderName: targetOrder.name,
    oldTags: currentTags,
    newTags,
    timestamp: new Date().toISOString()
  });

  await shopifyService.updateOrderTags(targetOrder.id.toString(), newTags);

  logger.info('=== SUCCESSFULLY UPDATED ORDER TAGS ===', {
    orderId: targetOrder.id,
    orderName: targetOrder.name,
    phone: customerPhone,
    newTags,
    timestamp: new Date().toISOString()
  });
}

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

// Send order confirmation notification
router.post('/order-confirmed', async (req, res) => {
  try {
    const { phone, orderNumber, customerName } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    if (!orderNumber) {
      return res.status(400).json({ error: 'Order number is required' });
    }

    if (!customerName) {
      return res.status(400).json({ error: 'Customer name is required' });
    }

    await whatsappService.sendOrderConfirmation(phone, orderNumber, customerName);

    res.json({ success: true, message: 'Order confirmation sent successfully' });
  } catch (error) {
    logger.error('Error sending order confirmation:', error);
    res.status(500).json({ error: 'Failed to send order confirmation' });
  }
});

// Send order ready notification
router.post('/order-ready', async (req, res) => {
  try {
    const { phone, orderNumber } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    if (!orderNumber) {
      return res.status(400).json({ error: 'Order number is required' });
    }

    // Send the message and get the message ID
    const messageId = await whatsappService.sendOrderReady(phone, orderNumber);
    
    // Store the order number for this message ID
    if (messageId) {
      storeOrderNumberForMessage(messageId, orderNumber);
    }

    res.json({ success: true, message: 'Order ready notification sent successfully' });
  } catch (error) {
    logger.error('Error sending order ready notification:', error);
    res.status(500).json({ error: 'Failed to send order ready notification' });
  }
});

// Send order received notification
router.post('/order-received', async (req, res) => {
  try {
    const { phone, orderNumber, customerName } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    if (!orderNumber) {
      return res.status(400).json({ error: 'Order number is required' });
    }

    if (!customerName) {
      return res.status(400).json({ error: 'Customer name is required' });
    }

    await whatsappService.sendOrderReceived(phone, orderNumber, customerName);

    res.json({ success: true, message: 'Order received notification sent successfully' });
  } catch (error) {
    logger.error('Error sending order received notification:', error);
    res.status(500).json({ error: 'Failed to send order received notification' });
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
    logger.info('=== WHATSAPP WEBHOOK RECEIVED ===', {
      body: req.body,
      timestamp: new Date().toISOString()
    });

    for (const e of entry) {
      for (const change of e.changes) {
        // Handle message statuses
        if (change.value.messages) {
          for (const message of change.value.messages) {
            // Debug log each message
            console.log('=== PROCESSING MESSAGE ===');
            console.log('Full message:', JSON.stringify(message, null, 2));
            
            logger.info('=== PROCESSING MESSAGE ===', {
              messageType: message.type,
              messageId: message.id,
              from: message.from,
              timestamp: message.timestamp,
              button: message.button,
              text: message.text,
              context: message.context,
              fullMessage: JSON.stringify(message, null, 2)
            });

            // Log the exact button text if it exists
            if (message.button) {
              logger.info('=== BUTTON DETAILS ===', {
                text: message.button.text,
                payload: message.button.payload
              });
            }

            // Handle button responses - using exact text match
            if (message.type === 'button' && message.button) {
              const buttonText = message.button.text.trim();
              const expectedText = "Yes, I'll be available".trim();

              logger.info('=== BUTTON RESPONSE PROCESSING ===', {
                buttonText,
                expectedText,
                exactMatch: buttonText === expectedText,
                timestamp: new Date().toISOString()
              });

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
                
                logger.info('=== CUSTOMER CONFIRMATION DETECTED ===', {
                  phone: customerPhone,
                  messageId: message.id,
                  timestamp: new Date().toISOString()
                });

                try {
                  // Extract order number from message context
                  let orderNumber = null;
                  
                  // Check if there's a context (reply to a template message)
                  if (message.context && message.context.id) {
                    logger.info('=== MESSAGE CONTEXT FOUND ===', {
                      contextId: message.context.id,
                      context: message.context
                    });
                    
                    // Get order number from our stored mapping
                    orderNumber = getOrderNumberForMessage(message.context.id);
                  }
                  
                  logger.info('=== EXTRACTED ORDER NUMBER ===', {
                    orderNumber,
                    phone: customerPhone,
                    timestamp: new Date().toISOString()
                  });

                  if (!orderNumber) {
                    logger.warn('No order number found for message context', {
                      phone: customerPhone,
                      contextId: message.context?.id,
                      timestamp: new Date().toISOString()
                    });
                    return;
                  }

                  // Use order number to find the specific order
                  logger.info('=== SEARCHING ORDER BY ORDER NUMBER ===', {
                    orderNumber,
                    phone: customerPhone,
                    timestamp: new Date().toISOString()
                  });

                  const targetOrder = await shopifyService.findOrderByOrderNumber(orderNumber);
                  
                  if (targetOrder) {
                    logger.info('=== FOUND ORDER BY ORDER NUMBER ===', {
                      orderId: targetOrder.id,
                      orderName: targetOrder.name,
                      orderNumber,
                      currentTags: targetOrder.tags,
                      timestamp: new Date().toISOString()
                    });

                    await updateOrderWithCustomerConfirmation(targetOrder, customerPhone);
                  } else {
                    logger.warn('Order not found by order number', {
                      orderNumber,
                      phone: customerPhone,
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
import express from 'express';
import { WhatsAppMonitor } from '../services/monitoring/WhatsAppMonitor';
import { WhatsAppService } from '../services/whatsapp';
import { MessageService } from '../services/messageService';
import { logger } from '../utils/logger';
import { ShopifyService } from '../services/shopify';
import { supabase } from '../config/supabase';

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

// Test Supabase connection
router.get('/test-supabase', async (req, res) => {
  try {
    logger.info('Testing Supabase connection...');
    
    // Test basic connection
    const { data: testData, error: testError } = await supabase
      .from('whatsapp_messages')
      .select('count')
      .limit(1);
    
    if (testError) {
      logger.error('Supabase connection test failed:', {
        error: testError.message,
        details: testError.details,
        hint: testError.hint
      });
      return res.status(500).json({ 
        success: false, 
        error: 'Supabase connection failed',
        details: testError 
      });
    }
    
    // Test inserting a sample message
    const testMessage = {
      message_id: `test-${Date.now()}`,
      phone: '201000000000',
      from: '201000000000',
      to: process.env.WHATSAPP_PHONE_NUMBER_ID || 'test',
      type: 'text',
      text: { body: 'Test message' },
      timestamp: new Date().toISOString(),
      status: 'sent',
      direction: 'outbound'
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from('whatsapp_messages')
      .insert(testMessage)
      .select()
      .single();
    
    if (insertError) {
      logger.error('Supabase insert test failed:', {
        error: insertError.message,
        details: insertError.details,
        hint: insertError.hint
      });
      return res.status(500).json({ 
        success: false, 
        error: 'Supabase insert failed',
        details: insertError 
      });
    }
    
    // Clean up test message
    await supabase
      .from('whatsapp_messages')
      .delete()
      .eq('message_id', testMessage.message_id);
    
    logger.info('Supabase connection test successful');
    res.json({ 
      success: true, 
      message: 'Supabase connection working',
      testData: insertData 
    });
  } catch (error) {
    logger.error('Supabase test error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Test failed',
      details: error 
    });
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

// Send text message (for inbox functionality)
router.post('/send-text', async (req, res) => {
  try {
    const { phone, message } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Send the text message
    const messageId = await whatsappService.sendTextMessage(phone, message.trim());

    res.json({ 
      success: true, 
      message: 'Text message sent successfully',
      messageId 
    });
  } catch (error) {
    logger.error('Error sending text message:', error);
    res.status(500).json({ error: 'Failed to send text message' });
  }
});

// Get conversation history for a specific phone number
router.get('/conversation/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const { limit = 50 } = req.query;
    
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const messages = await whatsappService.getConversationHistory(phone, Number(limit));

    res.json({ 
      success: true, 
      messages,
      count: messages.length
    });
  } catch (error) {
    logger.error('Error fetching conversation history:', error);
    res.status(500).json({ error: 'Failed to fetch conversation history' });
  }
});

// Get all conversations
router.get('/conversations', async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const conversations = await whatsappService.getAllConversations(Number(limit));

    res.json({ 
      success: true, 
      conversations,
      count: conversations.length
    });
  } catch (error) {
    logger.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Mark messages as read for a phone number
router.post('/mark-read/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    await MessageService.markMessagesAsRead(phone);

    res.json({ 
      success: true, 
      message: 'Messages marked as read successfully'
    });
  } catch (error) {
    logger.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

// Get message statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await MessageService.getMessageStats();

    res.json({ 
      success: true, 
      stats
    });
  } catch (error) {
    logger.error('Error getting message statistics:', error);
    res.status(500).json({ error: 'Failed to get message statistics' });
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

            // Store incoming message in database
            try {
              logger.info('=== STORING INCOMING MESSAGE ===', {
                message_id: message.id,
                phone: message.from,
                type: message.type,
                text: message.text,
                timestamp: message.timestamp
              });

              await MessageService.storeMessage({
                message_id: message.id,
                phone: message.from,
                from: message.from,
                to: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
                type: message.type,
                text: message.text,
                timestamp: new Date(parseInt(message.timestamp) * 1000),
                direction: 'inbound'
              });

              logger.info('=== MESSAGE STORED SUCCESSFULLY ===', {
                message_id: message.id,
                phone: message.from
              });
            } catch (error) {
              logger.error('Error storing incoming message', {
                error: error instanceof Error ? error.message : error,
                errorStack: error instanceof Error ? error.stack : undefined,
                errorDetails: JSON.stringify(error, null, 2),
                message_id: message.id,
                phone: message.from,
                type: message.type,
                text: message.text,
                timestamp: message.timestamp
              });
            }

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
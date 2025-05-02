import express from 'express';
import whatsappService, { OrderStatusTemplate } from '../services/whatsapp';
import fileUpload from 'express-fileupload';

const router = express.Router();

// Use file upload middleware for QR code image
router.use(fileUpload());

// Initialize WhatsApp client
router.get('/init', async (req, res) => {
  try {
    // Check if running in serverless environment
    if (process.env.VERCEL === '1') {
      return res.status(200).json({
        status: 'serverless',
        message: 'WhatsApp Web is not available in serverless environment. Please use the fallback direct WhatsApp link.'
      });
    }

    // Set up event listener for QR code
    whatsappService.once('qr', (qr) => {
      res.json({ status: 'qr_needed', qr });
    });

    // Set up event listener for ready state
    whatsappService.once('ready', () => {
      res.json({ status: 'ready' });
    });

    // Set up event listener for auth failure
    whatsappService.once('auth_failure', (msg) => {
      res.status(401).json({ status: 'auth_failure', error: msg });
    });

    // Initialize WhatsApp client with timeout of 30 seconds
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout: QR code not scanned in time')), 30000);
    });

    // Try to initialize, but fail if it takes too long
    await Promise.race([
      whatsappService.initialize(),
      timeoutPromise
    ]);

    // If we get here without any events triggering, client was already authenticated
    if (!res.headersSent) {
      res.json({ status: 'initializing' });
    }
  } catch (error) {
    console.error('Error initializing WhatsApp:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// Get WhatsApp client status
router.get('/status', (req, res) => {
  try {
    // Check if running in serverless environment
    if (process.env.VERCEL === '1') {
      return res.status(200).json({ 
        status: 'success', 
        data: {
          isReady: false,
          queueLength: 0,
          isProcessingQueue: false,
          isServerless: true
        }
      });
    }

    const status = whatsappService.getStatus();
    res.json({ status: 'success', data: status });
  } catch (error) {
    console.error('Error getting WhatsApp status:', error);
    res.status(500).json({ 
      status: 'error', 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Send a message
router.post('/send', async (req, res) => {
  try {
    // Check if running in serverless environment
    if (process.env.VERCEL === '1') {
      return res.status(200).json({ 
        status: 'serverless', 
        message: 'WhatsApp Web is not available in serverless environment. Please use the fallback direct WhatsApp link.',
        fallbackLink: `https://wa.me/${req.body.phone}?text=${encodeURIComponent(req.body.message)}`
      });
    }

    const { phone, message } = req.body;
    
    if (!phone || !message) {
      return res.status(400).json({ 
        status: 'error', 
        error: 'Phone number and message are required' 
      });
    }
    
    const result = await whatsappService.sendMessage(phone, message);
    res.json({ status: 'success', queued: result });
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    res.status(500).json({ 
      status: 'error', 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Send order status update
router.post('/send-order-status', async (req, res) => {
  try {
    const { phone, orderData } = req.body;
    
    if (!phone || !orderData) {
      return res.status(400).json({ 
        status: 'error', 
        error: 'Phone number and order data are required' 
      });
    }
    
    // Validate order data
    const requiredFields = ['orderId', 'customerName', 'orderStatus'];
    for (const field of requiredFields) {
      if (!orderData[field]) {
        return res.status(400).json({ 
          status: 'error', 
          error: `Missing required field: ${field}` 
        });
      }
    }
    
    // Create message from template
    const message = whatsappService.createOrderStatusMessage(orderData as OrderStatusTemplate);
    
    // Send message
    const result = await whatsappService.sendMessage(phone, message);
    res.json({ 
      status: 'success', 
      queued: result,
      message: message
    });
  } catch (error) {
    console.error('Error sending order status message:', error);
    res.status(500).json({ 
      status: 'error', 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Disconnect WhatsApp client
router.post('/disconnect', async (req, res) => {
  try {
    await whatsappService.disconnect();
    res.json({ status: 'success', message: 'WhatsApp client disconnected' });
  } catch (error) {
    console.error('Error disconnecting WhatsApp client:', error);
    res.status(500).json({ 
      status: 'error', 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Send WhatsApp message
router.post('/send-message', async (req, res) => {
  try {
    const { orderId, phone, message } = req.body;
    
    if (!phone || !message) {
      return res.status(400).json({ success: false, error: 'Phone number and message are required' });
    }
    
    await whatsappService.sendMessage(phone, message);
    res.json({ success: true });
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    res.status(500).json({ success: false, error: 'Failed to send WhatsApp message' });
  }
});

// Send confirmation message (uses a template)
router.post('/send-confirmation', async (req, res) => {
  try {
    const { orderId, phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }
    
    await whatsappService.sendConfirmationMessage(phone, orderId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error sending confirmation message:', error);
    res.status(500).json({ success: false, error: 'Failed to send confirmation message' });
  }
});

// Send message via direct WhatsApp web link
router.post('/send-via-link', async (req, res) => {
  try {
    const { phone, message } = req.body;
    
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }
    
    // Generate WhatsApp web link
    const formattedPhone = phone.replace(/\D/g, '');
    const encodedMessage = encodeURIComponent(message || '');
    const whatsappLink = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
    
    res.json({ success: true, data: { whatsappLink } });
  } catch (error) {
    console.error('Error generating WhatsApp link:', error);
    res.status(500).json({ success: false, error: 'Failed to generate WhatsApp link' });
  }
});

export default router; 
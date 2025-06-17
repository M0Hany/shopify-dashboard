import express from 'express';
import { WhatsAppMonitor } from '../services/monitoring/WhatsAppMonitor';
import { WhatsAppService } from '../services/whatsapp';
import { logger } from '../utils/logger';

const router = express.Router();
const whatsappService = new WhatsAppService();

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
router.post('/webhook', express.json(), (req, res) => {
  try {
    const { entry } = req.body;

    for (const e of entry) {
      for (const change of e.changes) {
        if (change.value.messages) {
          for (const message of change.value.messages) {
            if (message.statuses) {
              for (const status of message.statuses) {
                const messageId = status.id;
                let messageStatus: 'sent' | 'delivered' | 'read' | 'failed';

                switch (status.status) {
                  case 'sent':
                    messageStatus = 'sent';
                    break;
                  case 'delivered':
                    messageStatus = 'delivered';
                    break;
                  case 'read':
                    messageStatus = 'read';
                    break;
                  default:
                    messageStatus = 'failed';
                }

                WhatsAppMonitor.updateMessageStatus(
                  messageId,
                  messageStatus,
                  status.errors ? JSON.stringify(status.errors) : undefined
                );
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
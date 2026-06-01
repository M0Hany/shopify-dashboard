import express from 'express';
import { isWabaEnabled } from '../config/whatsappConfig';
import { OrderConfirmationService } from '../services/orderConfirmation.service';
import { whatsappWebService } from '../services/whatsappWeb.service';
import { logger } from '../utils/logger';

const router = express.Router();
const orderConfirmationService = OrderConfirmationService.getInstance();

/** Hub dashboard stats (used when WABA inbox is off). */
router.get('/stats', async (_req, res) => {
  try {
    const web = whatsappWebService.getStatus();
    let pendingConfirmations = 0;

    try {
      const orders = await orderConfirmationService.getPendingConfirmationOrders();
      pendingConfirmations = orders.length;
    } catch (err) {
      logger.warn('Could not count pending confirmations for hub stats', { err });
    }

    res.json({
      success: true,
      mode: 'hub',
      stats: {
        unreadMessages: pendingConfirmations,
        pendingConfirmations,
        webStatus: web.status,
        webConnected: web.status === 'connected',
        connectedPhone: web.connectedPhone
      }
    });
  } catch (error) {
    logger.error('Error getting WhatsApp hub stats', { error });
    res.status(500).json({ error: 'Failed to get hub stats' });
  }
});

router.get('/features', (_req, res) => {
  res.json({
    wabaEnabled: isWabaEnabled(),
    whatsAppWebEnabled: whatsappWebService.isEnabled()
  });
});

export default router;

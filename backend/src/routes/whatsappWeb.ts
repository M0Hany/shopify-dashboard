import express from 'express';
import { requireWhatsAppWebAdmin } from '../middleware/whatsappWebAdmin';
import { whatsappWebService } from '../services/whatsappWeb.service';
import { logger } from '../utils/logger';

const router = express.Router();

router.use(requireWhatsAppWebAdmin);

router.get('/status', (_req, res) => {
  whatsappWebService.ensureStarted();
  res.json(whatsappWebService.getStatus());
});

router.get('/qr', async (_req, res) => {
  if (!whatsappWebService.isEnabled()) {
    return res.json({
      enabled: false,
      status: 'disabled',
      qrDataUrl: null,
      message:
        'WhatsApp Web is off. Add WHATSAPP_WEB_ENABLED=true to backend/.env and restart the server.'
    });
  }

  whatsappWebService.ensureStarted();

  const status = whatsappWebService.getStatus();
  if (status.status === 'connected') {
    return res.json({ status: 'connected', qrDataUrl: null });
  }

  const qrDataUrl = await whatsappWebService.getQrDataUrl();
  if (!qrDataUrl) {
    return res.json({
      status: status.status,
      qrDataUrl: null,
      message: 'QR not ready yet. Wait a few seconds and refresh.'
    });
  }

  res.json({ status: status.status, qrDataUrl });
});

router.post('/send-text', async (req, res) => {
  try {
    if (!whatsappWebService.isEnabled()) {
      return res.status(400).json({ error: 'WhatsApp Web is disabled on the server' });
    }

    const { phone, message } = req.body as { phone?: string; message?: string };
    if (!phone?.trim()) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    if (!message?.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    whatsappWebService.ensureStarted();
    const messageId = await whatsappWebService.sendTextMessage(
      phone.trim(),
      message.trim()
    );

    res.json({ success: true, messageId });
  } catch (error) {
    logger.error('WhatsApp Web send-text failed', { error });
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to send message'
    });
  }
});

router.post('/logout', async (_req, res) => {
  try {
    await whatsappWebService.logout();
    res.json({ success: true, message: 'Logged out. Scan a new QR to reconnect.' });
  } catch (error) {
    logger.error('WhatsApp Web logout failed', { error });
    res.status(500).json({ error: 'Failed to log out WhatsApp Web session' });
  }
});

export default router;

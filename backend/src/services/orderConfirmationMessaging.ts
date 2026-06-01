import { isWabaEnabled, isWhatsAppWebEnabled } from '../config/whatsappConfig';
import { logger } from '../utils/logger';
import { buildOrderConfirmationMessage } from '../utils/orderConfirmationMessage';
import { WhatsAppService } from './whatsapp';
import { whatsappWebService } from './whatsappWeb.service';

/** Sends the new-order confirmation via WhatsApp Web (Baileys) or WABA fallback. */
export async function sendOrderConfirmationMessage(
  phone: string,
  orderNumber: string,
  customerName: string
): Promise<void> {
  const message = await buildOrderConfirmationMessage(customerName, orderNumber);

  if (isWhatsAppWebEnabled()) {
    await whatsappWebService.sendTextMessage(phone, message, orderNumber);
    logger.info('Order confirmation sent via WhatsApp Web', {
      orderNumber,
      phone
    });
    return;
  }

  if (!isWabaEnabled()) {
    throw new Error(
      'Order confirmation is not configured. Enable WHATSAPP_WEB_ENABLED or WHATSAPP_WABA_ENABLED.'
    );
  }

  const waba = new WhatsAppService();
  await waba.sendOrderConfirmation(phone, orderNumber, customerName);
  logger.info('Order confirmation sent via WABA', { orderNumber, phone });
}

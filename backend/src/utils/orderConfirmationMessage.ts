import { whatsappTemplateService } from '../services/whatsappTemplateService';

const DEFAULT_ORDER_CONFIRMED_BODY = `Hello {{customer_first_name}}✨
OCD Crochet here, your order is confirmed! 

Since every piece is handmade by one person, delivery may take around 2 weeks. 

Thank you for your patience!
Please kindly confirm 🤍`;

export async function buildOrderConfirmationMessage(
  customerName: string,
  orderNumber: string
): Promise<string> {
  const firstName = customerName?.trim() || 'Customer';
  let body = DEFAULT_ORDER_CONFIRMED_BODY;

  try {
    const template = await whatsappTemplateService.getByKey('order_confirmed');
    if (template?.body?.trim()) {
      body = template.body;
    }
  } catch {
    // Use default body if template lookup fails
  }

  return body
    .replace(/\{\{customer_first_name\}\}/g, firstName)
    .replace(/\{\{order_number\}\}/g, orderNumber)
    .replace(/\{\{1\}\}/g, firstName)
    .replace(/\{\{2\}\}/g, orderNumber);
}

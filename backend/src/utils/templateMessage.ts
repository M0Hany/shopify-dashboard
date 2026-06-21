import { whatsappTemplateService } from '../services/whatsappTemplateService';

export type TemplatePlaceholderData = {
  customer_first_name: string;
  items_list?: string;
  items_list_simple?: string;
  order_number: string;
  shipping_price?: string;
  total_price?: string;
};

export function applyTemplatePlaceholders(
  body: string,
  data: TemplatePlaceholderData
): string {
  const itemsList = data.items_list ?? '—';
  const itemsListSimple = data.items_list_simple ?? itemsList;
  return body
    .replace(/\{\{customer_first_name\}\}/g, data.customer_first_name)
    .replace(/\{\{items_list\}\}/g, itemsList)
    .replace(/\{\{items_list_simple\}\}/g, itemsListSimple)
    .replace(/\{\{order_number\}\}/g, data.order_number)
    .replace(/\{\{shipping_price\}\}/g, data.shipping_price ?? '—')
    .replace(/\{\{total_price\}\}/g, data.total_price ?? '—')
    .replace(/\{\{1\}\}/g, data.customer_first_name)
    .replace(/\{\{2\}\}/g, data.order_number);
}

export async function buildTemplateMessageByKey(
  templateKey: string,
  data: TemplatePlaceholderData,
  defaultBody: string
): Promise<string> {
  let body = defaultBody;
  try {
    const template = await whatsappTemplateService.getByKey(templateKey);
    if (template?.body?.trim()) {
      body = template.body;
    }
  } catch {
    // use default
  }
  return applyTemplatePlaceholders(body, data);
}

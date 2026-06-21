/** Egypt-focused digits for wa.me links */
export function formatPhoneForWhatsApp(phone: string): string {
  let formatted = phone.replace(/\D/g, '');
  if (formatted.startsWith('201')) formatted = formatted.substring(0, 12);
  else if (formatted.startsWith('20')) formatted = '201' + formatted.substring(2, 12);
  else if (formatted.startsWith('01')) formatted = ('2' + formatted).substring(0, 12);
  else if (formatted.startsWith('1')) formatted = ('20' + formatted).substring(0, 12);
  else formatted = ('201' + formatted).substring(0, 12);
  return formatted;
}

export function buildWaMeLink(phone: string, message: string): string {
  return `https://wa.me/${formatPhoneForWhatsApp(phone)}?text=${encodeURIComponent(message)}`;
}

export type LineItemForTemplate = {
  title: string;
  quantity?: number;
  price?: string;
  variant_title?: string | null;
};

export type OrderForTemplate = {
  name?: string;
  total_price?: string;
  line_items?: LineItemForTemplate[];
  shipping_lines?: Array<{ price: string; title?: string }>;
  total_shipping_price_set?: {
    shop_money?: { amount: string };
  };
};

export type TemplatePlaceholderData = {
  customer_first_name: string;
  items_list: string;
  items_list_simple?: string;
  order_number?: string;
  shipping_price?: string;
  total_price?: string;
};

export function formatEgp(amount: string | number): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (!Number.isFinite(n)) return '—';
  const rounded = Math.round(n * 100) / 100;
  if (Number.isInteger(rounded)) return `${rounded} EGP`;
  return `${rounded.toFixed(2)} EGP`;
}

export function getShippingAmount(order: OrderForTemplate): number {
  const fromSet = order.total_shipping_price_set?.shop_money?.amount;
  if (fromSet != null && fromSet !== '') {
    const parsed = parseFloat(fromSet);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (order.shipping_lines?.length) {
    return order.shipping_lines.reduce((sum, line) => sum + (parseFloat(line.price || '0') || 0), 0);
  }
  return 0;
}

export function formatShippingPrice(order: OrderForTemplate): string {
  const amount = getShippingAmount(order);
  return amount === 0 ? 'Free' : formatEgp(amount);
}

export function orderLineItemsSubtotal(items: LineItemForTemplate[]): number {
  return items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 1;
    const unit = parseFloat(item.price || '0') || 0;
    return sum + qty * unit;
  }, 0);
}

export function orderItemsList(
  lineItems: Array<{ title: string; variant_title?: string | null }> = []
): string {
  if (!lineItems.length) return '—';
  return lineItems
    .map((item) => {
      const variant = item.variant_title ? ` (${item.variant_title})` : '';
      return `- ${item.title}${variant}`;
    })
    .join('\n');
}

export function orderItemsListDetailed(lineItems: LineItemForTemplate[] = []): string {
  if (!lineItems.length) return '—';
  return lineItems
    .map((item) => {
      const variant = item.variant_title ? ` (${item.variant_title})` : '';
      const qty = Number(item.quantity) || 1;
      const unit = parseFloat(item.price || '0') || 0;
      const lineTotal = qty * unit;
      return `• ${item.title}${variant}\n  ${qty} × ${formatEgp(unit)} = ${formatEgp(lineTotal)}`;
    })
    .join('\n\n');
}

export function buildOrderTemplatePlaceholders(
  order: OrderForTemplate,
  customerFirstName: string,
  lineItems?: LineItemForTemplate[]
): TemplatePlaceholderData {
  const items = lineItems ?? order.line_items ?? [];
  const shippingAmount = getShippingAmount(order);
  const parsedTotal = parseFloat(order.total_price || '');
  const totalAmount = Number.isFinite(parsedTotal)
    ? parsedTotal
    : orderLineItemsSubtotal(items) + shippingAmount;

  return {
    customer_first_name: customerFirstName,
    order_number: order.name || '—',
    items_list: orderItemsListDetailed(items),
    items_list_simple: orderItemsList(items),
    shipping_price: formatShippingPrice(order),
    total_price: formatEgp(totalAmount),
  };
}

export function applyTemplatePlaceholders(body: string, data: TemplatePlaceholderData): string {
  const itemsList = data.items_list ?? '—';
  const itemsListSimple = data.items_list_simple ?? itemsList;
  return body
    .replace(/\{\{customer_first_name\}\}/g, data.customer_first_name)
    .replace(/\{\{items_list\}\}/g, itemsList)
    .replace(/\{\{items_list_simple\}\}/g, itemsListSimple)
    .replace(/\{\{order_number\}\}/g, data.order_number ?? '—')
    .replace(/\{\{shipping_price\}\}/g, data.shipping_price ?? '—')
    .replace(/\{\{total_price\}\}/g, data.total_price ?? '—');
}

export function getOrderPhone(order: {
  customer?: { phone?: string };
  shipping_address?: { phone?: string };
}): string | null {
  const phone = order.customer?.phone || order.shipping_address?.phone;
  return phone?.trim() || null;
}

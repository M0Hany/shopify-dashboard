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

export function applyTemplatePlaceholders(
  body: string,
  data: { customer_first_name: string; items_list: string; order_number?: string }
): string {
  return body
    .replace(/\{\{customer_first_name\}\}/g, data.customer_first_name)
    .replace(/\{\{items_list\}\}/g, data.items_list)
    .replace(/\{\{order_number\}\}/g, data.order_number ?? '—');
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

export function getOrderPhone(order: {
  customer?: { phone?: string };
  shipping_address?: { phone?: string };
}): string | null {
  const phone = order.customer?.phone || order.shipping_address?.phone;
  return phone?.trim() || null;
}

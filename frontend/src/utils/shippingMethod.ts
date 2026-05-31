export type ShippingMethodLabel = 'Company' | 'Scooter' | 'Pickup';

export const SHIPPING_METHOD_ORDER: ShippingMethodLabel[] = [
  'Company',
  'Scooter',
  'Pickup',
];

function normalizeTags(tags: string[] | string | undefined | null): string[] {
  if (Array.isArray(tags)) return tags;
  if (typeof tags === 'string') return tags.split(',').map((t) => t.trim());
  return [];
}

/** Resolve display shipping method from order tags (default: Company). */
export function getShippingMethodFromTags(
  tags: string[] | string | undefined | null
): ShippingMethodLabel {
  const tagList = normalizeTags(tags);
  const shippingMethodTag = tagList.find((tag) =>
    tag.trim().toLowerCase().startsWith('shipping_method:')
  );
  if (shippingMethodTag) {
    const method = shippingMethodTag.split(':')[1]?.trim().toLowerCase();
    if (method === 'scooter') return 'Scooter';
    if (method === 'pickup') return 'Pickup';
    if (
      method === 'other-company' ||
      method === 'other_company' ||
      method === 'company'
    ) {
      return 'Company';
    }
  }
  return 'Company';
}

export type ShippingConfirmationTemplateKey = 'company' | 'scooter';

/** WhatsApp order-ready confirmation template key in whatsapp_message_templates. */
export function getShippingConfirmationTemplateKey(
  tags: string[] | string | undefined | null
): ShippingConfirmationTemplateKey {
  const method = getShippingMethodFromTags(tags);
  if (method === 'Scooter' || method === 'Pickup') return 'scooter';
  return 'company';
}

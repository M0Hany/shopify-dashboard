/** Line item shape from GraphQL or REST before normalization. */
type RawLineItem = {
  title: string;
  quantity?: number;
  currentQuantity?: number;
  current_quantity?: number;
  price?: string;
  variant_title?: string | null;
  product_id?: number;
  variant_id?: number;
  properties?: Array<{ name: string; value: string }>;
};

type RawOrder = {
  total_price?: string;
  current_total_price?: string;
  line_items?: RawLineItem[];
  total_shipping_price_set?: {
    shop_money?: { amount?: string; currency_code?: string };
  };
  current_total_shipping_price_set?: {
    shop_money?: { amount?: string; currency_code?: string };
  };
};

/** Active line items after Shopify order edits (excludes removed / zero-qty rows). */
export function normalizeShopifyLineItems<T extends RawLineItem>(lineItems: T[] | undefined | null): T[] {
  return (lineItems ?? [])
    .map((item) => {
      const currentQty =
        item.currentQuantity ??
        item.current_quantity ??
        item.quantity ??
        0;
      return { ...item, quantity: currentQty };
    })
    .filter((item) => (item.quantity ?? 0) > 0);
}

/** Use post-edit totals from Shopify when available. */
export function normalizeShopifyOrder<T extends RawOrder>(order: T): T {
  const raw = order as RawOrder & Record<string, unknown>;
  const totalPrice =
    raw.current_total_price ??
    raw.currentTotalPrice ??
    order.total_price ??
    '0';

  const shippingSet =
    order.current_total_shipping_price_set ?? order.total_shipping_price_set;

  return {
    ...order,
    total_price: String(totalPrice),
    line_items: normalizeShopifyLineItems(order.line_items) as T['line_items'],
    ...(shippingSet ? { total_shipping_price_set: shippingSet } : {}),
  };
}

export type OrderLineItem = {
  title: string;
  quantity?: number;
  price?: string;
  variant_title?: string | null;
  product_id?: number;
  variant_id?: number;
};

/** Line items with quantity > 0 (excludes items removed via Shopify order edit). */
export function getActiveLineItems(
  lineItems: OrderLineItem[] | undefined | null
): OrderLineItem[] {
  return (lineItems ?? []).filter((item) => (Number(item.quantity) || 0) > 0);
}

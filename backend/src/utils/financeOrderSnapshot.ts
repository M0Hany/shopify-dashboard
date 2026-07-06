/** Fields the finance UI needs — keeps JSONB snapshots small and JSON-safe. */
export function slimOrderForFinanceSnapshot(order: Record<string, unknown>): Record<string, unknown> {
  const customer = order.customer as Record<string, unknown> | undefined;
  const lineItems = Array.isArray(order.line_items) ? order.line_items : [];

  return {
    id: order.id,
    name: order.name,
    tags: order.tags,
    total_price: order.total_price,
    created_at: order.created_at,
    customer: customer
      ? {
          first_name: customer.first_name,
          last_name: customer.last_name,
          phone: customer.phone,
        }
      : undefined,
    line_items: lineItems.map((item: Record<string, unknown>) => ({
      title: item.title,
      quantity: item.quantity,
      price: item.price,
      variant_title: item.variant_title,
      product_id: item.product_id,
      variant_id: item.variant_id,
    })),
    shipping_lines: order.shipping_lines,
    total_shipping_price_set: order.total_shipping_price_set,
  };
}

export function formatSupabaseError(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error);
  const e = error as { code?: string; message?: string; details?: string; hint?: string };
  return [e.code, e.message, e.details, e.hint].filter(Boolean).join(' — ');
}

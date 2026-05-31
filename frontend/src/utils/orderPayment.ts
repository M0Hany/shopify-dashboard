function normalizeTags(tags: string[] | string | undefined | null): string[] {
  if (Array.isArray(tags)) return tags;
  if (typeof tags === 'string') return tags.split(',').map((t) => t.trim());
  return [];
}

/** Dashboard `paid` tag (internal bookkeeping). */
export function isOrderPaidByTag(tags: string[] | string | undefined | null): boolean {
  return normalizeTags(tags).some((tag) => tag.trim().toLowerCase() === 'paid');
}

/** Shopify order payment status (`displayFinancialStatus` / `financial_status`). */
export function isShopifyPaymentPaid(financialStatus: string | undefined | null): boolean {
  if (!financialStatus?.trim()) return false;
  const normalized = financialStatus.trim().toUpperCase().replace(/\s+/g, '_');
  return normalized === 'PAID';
}

/** Green highlight when paid via tag or Shopify payment status. */
export function isOrderPaymentHighlighted(
  tags: string[] | string | undefined | null,
  financialStatus?: string | null
): boolean {
  return isOrderPaidByTag(tags) || isShopifyPaymentPaid(financialStatus);
}

/** Shown on courier map and shipping slips instead of a numeric price. */
export const PAID_ORDER_PRICE_LABEL = 'مدفوع';

/** Total for Excel export — 0 when order is considered paid. */
export function getOrderTotalAmountForExport(
  totalPrice: string | number | null | undefined,
  tags: string[] | string | undefined | null,
  financialStatus?: string | null
): number {
  if (isOrderPaymentHighlighted(tags, financialStatus)) return 0;
  return Number(totalPrice || 0);
}

/** Price label for slips and map UI — Arabic label when paid, otherwise null (caller formats amount). */
export function getPaidOrderPriceLabel(
  tags: string[] | string | undefined | null,
  financialStatus?: string | null
): string | null {
  return isOrderPaymentHighlighted(tags, financialStatus) ? PAID_ORDER_PRICE_LABEL : null;
}

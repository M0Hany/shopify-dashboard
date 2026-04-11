/** Priority Making product + tracked plushie variants (rush detection & UI hiding). */

export const PRIORITY_MAKING_PRODUCT_ID = '10411161747637';
export const PLUSHIE_PRODUCT_ID = '10401331314869';
export const PLUSHIE_RUSH_VARIANT_IDS = new Set(['52391850836149', '52391850868917']);

export function normalizeShopifyNumericId(id: unknown): string {
  if (id == null || id === '') return '';
  const s = String(id).trim();
  const gidTail = s.match(/(\d+)$/);
  return gidTail ? gidTail[1] : s.replace(/\D/g, '') || s;
}

export function isPriorityMakingLineItem(item: { product_id?: unknown; title?: string }): boolean {
  if (normalizeShopifyNumericId(item.product_id) === PRIORITY_MAKING_PRODUCT_ID) return true;
  const t = (item.title || '').trim().toLowerCase();
  return t === 'priority making';
}

export function isTrackedPlushieVariantItem(item: {
  product_id?: unknown;
  variant_id?: unknown;
}): boolean {
  const pid = normalizeShopifyNumericId(item.product_id);
  const vid = normalizeShopifyNumericId(item.variant_id);
  return pid === PLUSHIE_PRODUCT_ID && PLUSHIE_RUSH_VARIANT_IDS.has(vid);
}

export interface PriorityMakingAnalysis {
  hasPriorityMaking: boolean;
  priorityQty: number;
  plushieQty: number;
  quantitiesMatch: boolean;
}

export function analyzePriorityMakingLineItems(
  lineItems: Array<{ product_id?: unknown; variant_id?: unknown; quantity?: number; title?: string }> | undefined
): PriorityMakingAnalysis {
  const items = lineItems || [];
  let priorityQty = 0;
  let plushieQty = 0;
  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    if (isPriorityMakingLineItem(item)) priorityQty += qty;
    if (isTrackedPlushieVariantItem(item)) plushieQty += qty;
  }
  const hasPriorityMaking = priorityQty > 0;
  const quantitiesMatch = hasPriorityMaking && priorityQty === plushieQty;
  return { hasPriorityMaking, priorityQty, plushieQty, quantitiesMatch };
}

export function mergeRushTypeWithPriorityMaking(
  legacyRushType: 'Rushed' | 'Standard' | 'Mix',
  analysis: PriorityMakingAnalysis
): 'Rushed' | 'Standard' | 'Mix' {
  if (!analysis.hasPriorityMaking) return legacyRushType;
  if (!analysis.quantitiesMatch) return 'Mix';
  if (legacyRushType === 'Mix') return 'Mix';
  return 'Rushed';
}

/** Hide Priority Making from item lists when counts are valid. */
export function shouldHidePriorityMakingLine(analysis: PriorityMakingAnalysis): boolean {
  return analysis.hasPriorityMaking && analysis.quantitiesMatch;
}

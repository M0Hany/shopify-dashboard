/** Priority Making product + tracked plushie/bundle lines (rush detection & UI hiding). */

/** Current Priority Making product (variants: "Per plushie", "Per set") plus the legacy single-variant one. */
export const PRIORITY_MAKING_PRODUCT_IDS = ['15422585110845', '10411161747637'];

type LineItemLike = {
  product_id?: unknown;
  product_type?: string | null;
  quantity?: number;
  title?: string;
  variant_title?: string | null;
  properties?: Array<{ name?: string; value?: unknown }> | null;
};

export function normalizeShopifyNumericId(id: unknown): string {
  if (id == null || id === '') return '';
  const s = String(id).trim();
  const gidTail = s.match(/(\d+)$/);
  return gidTail ? gidTail[1] : s.replace(/\D/g, '') || s;
}

export function isPriorityMakingLineItem(item: LineItemLike): boolean {
  if (PRIORITY_MAKING_PRODUCT_IDS.includes(normalizeShopifyNumericId(item.product_id))) return true;
  const t = (item.title || '').trim().toLowerCase();
  return t === 'priority making';
}

/** "Per set" variant of Priority Making — covers one bundle line. */
export function isPrioritySetLineItem(item: LineItemLike): boolean {
  return isPriorityMakingLineItem(item) && /\bset\b/i.test(item.variant_title || '');
}

/** Bundle products (e.g. "Full Spider-Verse Set", "Spider-Verse Pair", "Egyptian Comedy Duo"). */
export function isBundleLineItem(item: LineItemLike): boolean {
  if (isPriorityMakingLineItem(item)) return false;
  if ((item.product_type || '').trim().toLowerCase() === 'bundle') return true;
  // Fallback for cached orders without product_type: bundles carry a "Free stickers" property.
  return (item.properties || []).some((p) => (p.name || '').trim().toLowerCase() === 'free stickers');
}

export function isPlushieLineItem(item: LineItemLike): boolean {
  // The Priority Making "Per plushie" variant must not count as a plushie itself.
  if (isPriorityMakingLineItem(item) || isBundleLineItem(item)) return false;
  return (item.title || '').toLowerCase().includes('plushie');
}

export interface PriorityMakingAnalysis {
  hasPriorityMaking: boolean;
  /** Total Priority Making units (per plushie + per set). */
  priorityQty: number;
  /** "Per plushie" (or legacy) Priority Making units. */
  priorityPlushieQty: number;
  /** "Per set" Priority Making units. */
  prioritySetQty: number;
  plushieQty: number;
  setQty: number;
  /** One Priority Making per plushie and one "Per set" per bundle. */
  quantitiesMatch: boolean;
}

export function analyzePriorityMakingLineItems(lineItems: LineItemLike[] | undefined): PriorityMakingAnalysis {
  const items = lineItems || [];
  let priorityPlushieQty = 0;
  let prioritySetQty = 0;
  let plushieQty = 0;
  let setQty = 0;
  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    if (isPriorityMakingLineItem(item)) {
      if (isPrioritySetLineItem(item)) prioritySetQty += qty;
      else priorityPlushieQty += qty;
    } else if (isBundleLineItem(item)) {
      setQty += qty;
    } else if (isPlushieLineItem(item)) {
      plushieQty += qty;
    }
  }
  const priorityQty = priorityPlushieQty + prioritySetQty;
  const hasPriorityMaking = priorityQty > 0;
  const quantitiesMatch =
    hasPriorityMaking && priorityPlushieQty === plushieQty && prioritySetQty === setQty;
  return { hasPriorityMaking, priorityQty, priorityPlushieQty, prioritySetQty, plushieQty, setQty, quantitiesMatch };
}

/** Short explanation shown on the Priority Making line when counts don't line up. */
export function describePriorityMismatch(analysis: PriorityMakingAnalysis): string {
  const parts = [`Priority per plushie (${analysis.priorityPlushieQty}) vs plushies (${analysis.plushieQty})`];
  if (analysis.prioritySetQty > 0 || analysis.setQty > 0) {
    parts.push(`per set (${analysis.prioritySetQty}) vs sets (${analysis.setQty})`);
  }
  return parts.join(' · ');
}

export function mergeRushTypeWithPriorityMaking(
  legacyRushType: 'Rushed' | 'Standard' | 'Mix',
  analysis: PriorityMakingAnalysis
): 'Rushed' | 'Standard' | 'Mix' {
  if (!analysis.hasPriorityMaking) return legacyRushType;
  if (!analysis.quantitiesMatch) return 'Mix';
  // Every plushie/set is covered by Priority Making — the whole order is rushed.
  return 'Rushed';
}

/** Hide Priority Making from item lists when counts are valid. */
export function shouldHidePriorityMakingLine(analysis: PriorityMakingAnalysis): boolean {
  return analysis.hasPriorityMaking && analysis.quantitiesMatch;
}

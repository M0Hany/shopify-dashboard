/** Aligns with Orders page `shipping_route:` tagging. */

export const SHIPPING_ROUTE_TAG_PREFIX = 'shipping_route:';
export const COURIER_ASSIGNED_TAG = 'courier_assigned';
export function normalizeOrderTagsArray(tags: string[] | string | null | undefined): string[] {
  if (tags == null) return [];
  if (Array.isArray(tags)) return tags.map((t) => String(t).trim()).filter(Boolean);
  return String(tags)
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Removes shipping-route tags (also strips legacy date tags). */
export function stripShippingRouteTags(tags: string[]): string[] {
  const pRoute = SHIPPING_ROUTE_TAG_PREFIX.toLowerCase();
  return tags.filter((t) => {
    const low = t.toLowerCase();
    return !low.startsWith(pRoute) && !low.startsWith('shipping_route_date:');
  });
}

/** Stable group key for map routes: `shipping_route:` name only. */
export function getMapShippingRouteGroupKey(order: { tags?: string[] | string | null }): string | null {
  const tags = normalizeOrderTagsArray(order.tags);
  const routeTag = tags.find((t) => t.toLowerCase().startsWith(SHIPPING_ROUTE_TAG_PREFIX.toLowerCase()));
  if (!routeTag) return null;
  const name = routeTag.slice(SHIPPING_ROUTE_TAG_PREFIX.length).trim();
  if (!name) return null;
  return name;
}

export type TagBuiltRoute = {
  id: string;
  name: string;
  orderIds: number[];
  fromTags: true;
};

export function buildDraftRoutesFromShippingTags(
  orders: { id: number; tags?: string[] | string | null }[]
): TagBuiltRoute[] {
  const groups = new Map<string, number[]>();
  for (const o of orders) {
    const key = getMapShippingRouteGroupKey(o);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(o.id);
  }
  const out: TagBuiltRoute[] = [];
  for (const [key, ids] of groups) {
    ids.sort((a, b) => a - b);
    out.push({
      id: `sr:${encodeURIComponent(key)}`,
      name: key,
      orderIds: ids,
      fromTags: true,
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return out;
}

/** Changes when any order’s shipping-route grouping changes (for resetting local overrides). */
export function shippingTagRoutesFingerprint(orders: { id: number; tags?: string[] | string | null }[]): string {
  return orders
    .map((o) => {
      const k = getMapShippingRouteGroupKey(o);
      return k ? `${o.id}:${k}` : '';
    })
    .filter(Boolean)
    .sort()
    .join('|');
}

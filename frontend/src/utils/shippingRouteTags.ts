/** Aligns with Orders page `shipping_route:` / `shipping_route_date:` tagging. */

export const SHIPPING_ROUTE_TAG_PREFIX = 'shipping_route:';
export const SHIPPING_ROUTE_DATE_PREFIX = 'shipping_route_date:';

const ROUTE_KEY_SEP = '\u001e';

export function normalizeOrderTagsArray(tags: string[] | string | null | undefined): string[] {
  if (tags == null) return [];
  if (Array.isArray(tags)) return tags.map((t) => String(t).trim()).filter(Boolean);
  return String(tags)
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Stable group key for map routes: `shipping_route:` name required; date optional
 * (orders with only `shipping_route:Nasr Helio` share key `__nodate__␞Nasr Helio`).
 */
export function getMapShippingRouteGroupKey(order: { tags?: string[] | string | null }): string | null {
  const tags = normalizeOrderTagsArray(order.tags);
  const routeTag = tags.find((t) => t.toLowerCase().startsWith(SHIPPING_ROUTE_TAG_PREFIX.toLowerCase()));
  if (!routeTag) return null;
  const name = routeTag.slice(SHIPPING_ROUTE_TAG_PREFIX.length).trim();
  if (!name) return null;
  const dateTag = tags.find((t) => t.toLowerCase().startsWith(SHIPPING_ROUTE_DATE_PREFIX.toLowerCase()));
  const dateStr = dateTag
    ? dateTag.slice(SHIPPING_ROUTE_DATE_PREFIX.length).trim() || '__nodate__'
    : '__nodate__';
  return `${dateStr}${ROUTE_KEY_SEP}${name}`;
}

export function parseMapRouteGroupKey(key: string): { date: string; name: string } {
  const i = key.indexOf(ROUTE_KEY_SEP);
  if (i === -1) return { date: '__nodate__', name: key };
  return { date: key.slice(0, i), name: key.slice(i + ROUTE_KEY_SEP.length) };
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
    const { name } = parseMapRouteGroupKey(key);
    out.push({
      id: `sr:${encodeURIComponent(key)}`,
      name,
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

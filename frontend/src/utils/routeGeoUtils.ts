import { getOrderLatLng, type OrderWithLocationAttrs } from './orderGeolocation';
import { normalizeOrderTagsArray } from './shippingRouteTags';

const R = 6371;

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

type MapOrder = OrderWithLocationAttrs & { total_price?: string };

function orderCancelled(o: MapOrder): boolean {
  const tags = normalizeOrderTagsArray(o.tags).map((t) => t.trim().toLowerCase());
  return tags.includes('cancelled');
}

/**
 * Road-style polyline length: depot → stops in order (skips stops without coords;
 * only adds segments when both endpoints have coordinates).
 */
export function routePathKm(
  depot: { lat: number; lng: number },
  orderIds: number[],
  byId: Map<number, MapOrder>
): number | null {
  let prev: { lat: number; lng: number } | null = null;
  let sum = 0;
  let any = false;

  for (const id of orderIds) {
    const o = byId.get(id);
    const ll = o ? getOrderLatLng(o) : null;
    if (!ll) continue;
    if (!prev) {
      sum += haversineKm(depot, ll);
      prev = ll;
      any = true;
    } else {
      sum += haversineKm(prev, ll);
      prev = ll;
      any = true;
    }
  }
  return any ? sum : null;
}

function routeRevenueEgp(orderIds: number[], byId: Map<number, MapOrder>): number {
  let sum = 0;
  for (const id of orderIds) {
    const o = byId.get(id);
    if (!o || orderCancelled(o)) continue;
    sum += parseFloat(o.total_price || '0');
  }
  return sum;
}

export function routeRowStats(
  orderIds: number[],
  byId: Map<number, MapOrder>,
  depot: { lat: number; lng: number }
): { km: number | null; revenue: number; count: number } {
  return {
    km: routePathKm(depot, orderIds, byId),
    revenue: routeRevenueEgp(orderIds, byId),
    count: orderIds.length,
  };
}

/**
 * Greedy nearest-neighbor from depot (shortest next hop). Stops without coords keep
 * relative order at the end.
 */
export function reoptimizeStopOrder(
  orderIds: number[],
  byId: Map<number, MapOrder>,
  depot: { lat: number; lng: number }
): number[] {
  if (orderIds.length <= 1) return [...orderIds];

  const withCoords: number[] = [];
  const without: number[] = [];
  for (const id of orderIds) {
    const o = byId.get(id);
    const ll = o ? getOrderLatLng(o) : null;
    if (ll) withCoords.push(id);
    else without.push(id);
  }

  const remaining = [...withCoords];
  const out: number[] = [];
  let cur = depot;

  while (remaining.length) {
    let bestId = remaining[0];
    let bestD = Infinity;
    const curLl = cur;
    for (const id of remaining) {
      const o = byId.get(id);
      const ll = o ? getOrderLatLng(o) : null;
      if (!ll) continue;
      const d = haversineKm(curLl, ll);
      if (d < bestD - 1e-9 || (Math.abs(d - bestD) < 1e-9 && id < bestId)) {
        bestD = d;
        bestId = id;
      }
    }
    out.push(bestId);
    const idx = remaining.indexOf(bestId);
    if (idx !== -1) remaining.splice(idx, 1);
    const nextO = byId.get(bestId);
    const nextLl = nextO ? getOrderLatLng(nextO) : null;
    if (nextLl) cur = nextLl;
  }

  return [...out, ...without];
}

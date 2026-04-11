/** Order-level checkout attributes (Shopify REST: note_attributes / GraphQL: customAttributes). */
export type OrderCustomAttribute = { key: string; value: string };

export type OrderWithLocationAttrs = {
  id: number;
  name: string;
  custom_attributes?: OrderCustomAttribute[];
  /** Optional: backfill pins via order tags (see TAG_LOCATION_FORMAT). */
  tags?: string[] | string | null;
};

/**
 * Manual location tags (for orders before /cart map). Add in Shopify Admin → order → Tags.
 *
 * **Preferred (one tag):** `pin:LAT` + separator + `LNG` — separators: `,` `;` `/` `|` or space.
 * Examples: `pin:30.119117,31.352819` · `pin:30.119117;31.352819` (safer if tags are ever merged as CSV)
 *
 * **Alias:** `geo:LAT,LNG` (same rules).
 *
 * **Two tags (no comma inside a tag):** `delivery_lat:30.119117` and `delivery_lng:31.352819`
 *
 * **Maps URL in a tag:** any tag whose text is a Google Maps link with `?q=lat,lng` or `@lat,lng`
 *
 * Checkout custom attributes (Latitude / Longitude / Google Maps) still take priority over tags.
 */
export const TAG_LOCATION_FORMAT = 'pin:30.119117;31.352819  or  delivery_lat:30.119117 + delivery_lng:31.352819';

function normalizeAttrMap(attrs?: OrderCustomAttribute[]): Record<string, string> {
  const m: Record<string, string> = {};
  if (!attrs) return m;
  for (const a of attrs) {
    const k = (a.key ?? '').trim().toLowerCase();
    if (k) m[k] = (a.value ?? '').trim();
  }
  return m;
}

function parseNumberLoose(s: string): number | null {
  const n = parseFloat(s.replace(/,/g, '.').trim());
  return Number.isFinite(n) ? n : null;
}

/** Parse lat,lng from common Google Maps URL patterns (query or path). */
export function tryParseLatLngFromMapsUrl(url: string): { lat: number; lng: number } | null {
  if (!url || typeof url !== 'string') return null;
  const decoded = url.trim();
  const qMatch = decoded.match(/[?&]q=([^&]+)/i);
  if (qMatch) {
    const inner = decodeURIComponent(qMatch[1].replace(/\+/g, ' '));
    const parts = inner.split(/[,\s]+/).filter(Boolean);
    if (parts.length >= 2) {
      const lat = parseNumberLoose(parts[0]);
      const lng = parseNumberLoose(parts[1]);
      if (lat !== null && lng !== null) return { lat, lng };
    }
  }
  const atMatch = decoded.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (atMatch) {
    const lat = parseNumberLoose(atMatch[1]);
    const lng = parseNumberLoose(atMatch[2]);
    if (lat !== null && lng !== null) return { lat, lng };
  }
  return null;
}

function isValidCoord(lat: number, lng: number): boolean {
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function normalizeTagsArray(tags: string[] | string | null | undefined): string[] {
  if (tags == null) return [];
  if (Array.isArray(tags)) return tags.map((t) => String(t).trim()).filter(Boolean);
  const s = String(tags).trim();
  if (!s) return [];
  // Pull whole pin/geo tokens first so commas inside "pin:lat,lng" are not used as tag separators
  const merged: string[] = [];
  const pinGeoPattern = /\b(?:pin|geo)\s*:\s*[\d.+\-eE]+(?:\s*[,;/|]\s*|\s+)[\d.+\-eE]+/gi;
  let last = 0;
  for (const m of s.matchAll(pinGeoPattern)) {
    if (m.index! > last) {
      merged.push(
        ...s
          .slice(last, m.index)
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      );
    }
    merged.push(m[0].trim());
    last = m.index! + m[0].length;
  }
  if (last < s.length) {
    merged.push(
      ...s
        .slice(last)
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    );
  }
  return merged.length > 0 ? merged : s.split(',').map((t) => t.trim()).filter(Boolean);
}

/** Parse `pin:lat,lng` or `geo:lat,lng` from order tags (backfill / legacy orders). */
function tryLatLngFromTags(tags: string[] | string | null | undefined): { lat: number; lng: number } | null {
  const list = normalizeTagsArray(tags);
  if (list.length === 0) return null;

  for (const raw of list) {
    const t = raw.trim();
    const low = t.toLowerCase();
    for (const prefix of ['pin:', 'geo:'] as const) {
      if (!low.startsWith(prefix)) continue;
      const rest = t.slice(prefix.length).trim();
      const parts = rest.split(/[,;\s|/]+/).map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const la = parseNumberLoose(parts[0]);
        const ln = parseNumberLoose(parts[1]);
        if (la !== null && ln !== null && isValidCoord(la, ln)) return { lat: la, lng: ln };
      }
    }
  }

  let deliveryLat: number | null = null;
  let deliveryLng: number | null = null;
  for (const raw of list) {
    const low = raw.trim().toLowerCase();
    if (low.startsWith('delivery_lat:')) {
      deliveryLat = parseNumberLoose(raw.slice(raw.indexOf(':') + 1));
    } else if (low.startsWith('delivery_lng:') || low.startsWith('delivery_lon:')) {
      deliveryLng = parseNumberLoose(raw.slice(raw.indexOf(':') + 1));
    }
  }
  if (deliveryLat !== null && deliveryLng !== null && isValidCoord(deliveryLat, deliveryLng)) {
    return { lat: deliveryLat, lng: deliveryLng };
  }

  for (const raw of list) {
    const v = raw.trim();
    if (v.includes('google.') && (v.includes('/maps') || v.includes('maps?'))) {
      const parsed = tryParseLatLngFromMapsUrl(v);
      if (parsed && isValidCoord(parsed.lat, parsed.lng)) return parsed;
    }
  }

  return null;
}

/**
 * Reads Latitude / Longitude attributes (case-insensitive) or a Google Maps URL attribute.
 * If missing, reads location from order tags: `pin:lat,lng`, `geo:lat,lng`, `delivery_lat:` / `delivery_lng:`, or a maps URL in a tag.
 */
export function getOrderLatLng(order: OrderWithLocationAttrs): { lat: number; lng: number } | null {
  const m = normalizeAttrMap(order.custom_attributes);
  let lat = parseNumberLoose(m['latitude'] ?? m['lat'] ?? '');
  let lng = parseNumberLoose(m['longitude'] ?? m['lng'] ?? m['long'] ?? m['lon'] ?? '');

  if (lat === null || lng === null) {
    const urlKeys = ['google maps', 'google_maps', 'googlemaps', 'map', 'maps', 'map url', 'location url'];
    for (const k of urlKeys) {
      const url = m[k];
      if (url) {
        const parsed = tryParseLatLngFromMapsUrl(url);
        if (parsed) {
          lat = parsed.lat;
          lng = parsed.lng;
          break;
        }
      }
    }
  }

  if (lat === null || lng === null) {
    for (const v of Object.values(m)) {
      if (v.includes('google.') && (v.includes('/maps') || v.includes('maps?'))) {
        const parsed = tryParseLatLngFromMapsUrl(v);
        if (parsed) {
          lat = parsed.lat;
          lng = parsed.lng;
          break;
        }
      }
    }
  }

  if (lat === null || lng === null) {
    const fromTags = tryLatLngFromTags(order.tags);
    if (fromTags) return fromTags;
  }

  if (lat === null || lng === null) return null;
  if (!isValidCoord(lat, lng)) return null;
  return { lat, lng };
}

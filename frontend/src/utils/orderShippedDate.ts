import { convertToCairoTime } from './dateUtils';

function normalizeTags(tags: string | string[] | undefined | null): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map((t) => t.trim());
  return tags.split(',').map((t) => t.trim());
}

/** Parse shipped_date:YYYY-MM-DD or shipping_date:YYYY-MM-DD from order tags. */
export function parseShippedDateFromTags(tags: string | string[] | undefined | null): Date | null {
  const shippedDateTag = normalizeTags(tags).find(
    (tag) =>
      tag.toLowerCase().startsWith('shipped_date:') ||
      tag.toLowerCase().startsWith('shipping_date:')
  );
  if (!shippedDateTag) return null;

  const dateStr = shippedDateTag.split(':').slice(1).join(':').trim();
  if (!dateStr) return null;

  const shippedDate = convertToCairoTime(new Date(dateStr));
  return Number.isNaN(shippedDate.getTime()) ? null : shippedDate;
}

/** Days since shipped_date tag (matches OrderCard badge). Returns null if tag missing. */
export function getDaysSinceShipped(order: { tags?: string | string[] }): number | null {
  const shippedDate = parseShippedDateFromTags(order.tags);
  if (!shippedDate) return null;

  const now = convertToCairoTime(new Date());
  const shipped = new Date(shippedDate);
  shipped.setHours(0, 0, 0, 0);
  const current = new Date(now);
  current.setHours(0, 0, 0, 0);

  const diffTime = current.getTime() - shipped.getTime();
  const days = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

/** Current month as YYYY-MM (local server time). */
export function getCurrentFinanceMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function isPastFinanceMonth(month: string): boolean {
  return month < getCurrentFinanceMonth();
}

export function isCurrentFinanceMonth(month: string): boolean {
  return month === getCurrentFinanceMonth();
}

export function parseOrderTags(tags: string[] | string | null | undefined): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map((t) => t.trim()).filter(Boolean);
  return tags.split(',').map((t) => t.trim()).filter(Boolean);
}

export function orderMonthFromTag(tags: string[], prefixes: string[]): string | null {
  for (const prefix of prefixes) {
    const tag = tags.find((t) => t.toLowerCase().startsWith(prefix.toLowerCase()));
    if (!tag) continue;
    const dateStr = tag.split(':').slice(1).join(':').trim();
    if (dateStr.length >= 7) return dateStr.substring(0, 7);
  }
  return null;
}

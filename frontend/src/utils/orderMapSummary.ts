import { calculateDaysRemaining, convertToCairoTime } from './dateUtils';
import {
  analyzePriorityMakingLineItems,
  mergeRushTypeWithPriorityMaking,
} from './priorityMakingRush';
import { SHIPPING_ROUTE_TAG_PREFIX, normalizeOrderTagsArray } from './shippingRouteTags';

/** Fields required to build the map marker summary (matches Orders `Order` subset). */
export type OrderForMapSummary = {
  id: number;
  name: string;
  created_at: string;
  effective_created_at: string;
  custom_due_date?: string;
  customer: { first_name: string; last_name: string; phone: string };
  shipping_address: {
    address1: string;
    address2?: string;
    city: string;
    province: string;
    zip: string;
    country: string;
  };
  total_price: string;
  financial_status: string;
  fulfillment_status: string;
  tags?: string[] | string | null;
  custom_attributes?: Array<{ key: string; value: string }>;
  line_items: Array<{
    title: string;
    quantity: number;
    variant_title: string | null;
    properties?: Array<{ name: string; value: string }>;
  }>;
  fulfillments?: Array<{
    displayStatus?: string;
    updated_at?: string;
  }>;
};

function detectLegacyMakingTime(lineItems: OrderForMapSummary['line_items']): number | null {
  if (!lineItems || lineItems.length === 0) return null;

  for (const item of lineItems) {
    const title = item.title || '';

    const rushMatch = title.match(/rush.*?\[(\d+)\s*days?\]/i);
    if (rushMatch) return 3;

    const handmadeMatch = title.match(/handmade.*?\[(\d+)\s*days?\]/i);
    if (handmadeMatch) return parseInt(handmadeMatch[1], 10);

    if (item.properties && Array.isArray(item.properties)) {
      for (const prop of item.properties) {
        const propName = (prop.name || '').toLowerCase();
        const propValue = prop.value || '';

        if (propName.includes('making time') || propName.includes('timeline') || propName.includes('rush')) {
          const rushPropMatch = propValue.match(/rush.*?\[(\d+)\s*days?\]/i);
          if (rushPropMatch) return 3;
          const handmadePropMatch = propValue.match(/handmade.*?\[(\d+)\s*days?\]/i);
          if (handmadePropMatch) return parseInt(handmadePropMatch[1], 10);
          const daysMatch = propValue.match(/(\d+)\s*days?/i);
          if (daysMatch && (propValue.toLowerCase().includes('rush') || propValue.toLowerCase().includes('3'))) {
            return propValue.toLowerCase().includes('rush') ? 3 : parseInt(daysMatch[1], 10);
          }
          if (daysMatch && (propValue.toLowerCase().includes('handmade') || propValue.toLowerCase().includes('7'))) {
            return parseInt(daysMatch[1], 10);
          }
        }
      }
    }

    if (title.toLowerCase().includes('making time') || title.toLowerCase().includes('choose your')) {
      if (title.toLowerCase().includes('rush') || title.match(/3\s*days?/i)) return 3;
      if (title.toLowerCase().includes('handmade') || title.match(/7\s*days?/i)) return 7;
    }
  }

  return null;
}

/** Matches Orders page `calculateDaysLeft` / OrderTimeline. */
export function calculateOrderDaysLeft(order: OrderForMapSummary): number {
  try {
    const now = convertToCairoTime(new Date());
    const tags = normalizeOrderTagsArray(order.tags);

    let dueDate: Date | null = null;

    if (order.custom_due_date) {
      const parsed = convertToCairoTime(new Date(order.custom_due_date));
      if (!isNaN(parsed.getTime())) dueDate = parsed;
    }

    if (!dueDate) {
      const dueDateTag = tags.find((tag: string) => tag.startsWith('custom_due_date:'));
      if (dueDateTag) {
        const dateStr = dueDateTag.split(':').slice(1).join(':');
        if (dateStr) {
          const parsedDueDate = convertToCairoTime(new Date(dateStr));
          if (!isNaN(parsedDueDate.getTime())) dueDate = parsedDueDate;
        }
      }
    }

    if (!dueDate || isNaN(dueDate.getTime())) {
      const startDateTag = tags.find((tag: string) => tag.startsWith('custom_start_date:'));
      let startDate: Date;

      if (startDateTag) {
        const dateStr = startDateTag.split(':').slice(1).join(':');
        if (dateStr) {
          const parsedDate = convertToCairoTime(new Date(dateStr));
          if (!isNaN(parsedDate.getTime())) {
            startDate = parsedDate;
          } else {
            const fallbackDate = order.created_at || order.effective_created_at || new Date().toISOString();
            startDate = convertToCairoTime(new Date(fallbackDate));
            if (isNaN(startDate.getTime())) startDate = now;
          }
        } else {
          const fallbackDate = order.created_at || order.effective_created_at || new Date().toISOString();
          startDate = convertToCairoTime(new Date(fallbackDate));
          if (isNaN(startDate.getTime())) startDate = now;
        }
      } else {
        const fallbackDate = order.created_at || order.effective_created_at;
        if (fallbackDate) {
          startDate = convertToCairoTime(new Date(fallbackDate));
          if (isNaN(startDate.getTime())) startDate = now;
        } else {
          startDate = now;
        }
      }

      const pm = analyzePriorityMakingLineItems(order.line_items || []);
      const makingTimeDays =
        pm.hasPriorityMaking && pm.quantitiesMatch ? 3 : detectLegacyMakingTime(order.line_items || []);
      const daysToAdd = makingTimeDays || 7;

      const calculatedDueDate = new Date(startDate);
      calculatedDueDate.setDate(calculatedDueDate.getDate() + daysToAdd);
      dueDate = convertToCairoTime(calculatedDueDate);

      if (!dueDate || isNaN(dueDate.getTime())) return 7;
    }

    return calculateDaysRemaining(dueDate, now);
  } catch {
    return 7;
  }
}

function daysLeftLabel(daysLeft: number): string {
  if (daysLeft < 0) {
    const absDays = Math.abs(daysLeft);
    return absDays === 1 ? '1 day overdue' : `${absDays} days overdue`;
  }
  if (daysLeft === 0) return 'Due today';
  if (daysLeft === 1) return '1 day left';
  return `${daysLeft} days left`;
}

function workflowStatus(order: OrderForMapSummary): { label: string; chipClass: string } {
  const tags = normalizeOrderTagsArray(order.tags).map((t) => t.trim().toLowerCase());

  if (tags.includes('deleted')) return { label: 'Hidden', chipClass: 'bg-gray-200 text-gray-700' };
  if (tags.some((t) => t === 'cancelled')) return { label: 'Cancelled', chipClass: 'bg-red-100 text-red-800' };
  if (tags.some((t) => t === 'paid')) return { label: 'Paid', chipClass: 'bg-indigo-100 text-indigo-800' };
  if (tags.some((t) => t === 'fulfilled')) return { label: 'Fulfilled', chipClass: 'bg-emerald-100 text-emerald-800' };
  if (tags.some((t) => t === 'shipped')) return { label: 'Shipped', chipClass: 'bg-purple-100 text-purple-800' };
  if (tags.some((t) => t === 'ready_to_ship')) return { label: 'Ready to ship', chipClass: 'bg-blue-100 text-blue-800' };
  if (tags.some((t) => t === 'customer_confirmed')) return { label: 'Confirmed', chipClass: 'bg-green-100 text-green-800' };
  if (tags.some((t) => t === 'on_hold')) return { label: 'On hold', chipClass: 'bg-amber-100 text-amber-900' };
  if (tags.some((t) => t === 'order_ready')) return { label: 'Order ready', chipClass: 'bg-orange-100 text-orange-900' };
  return { label: 'Pending', chipClass: 'bg-yellow-100 text-yellow-900' };
}

function shippingMethodFromTags(order: OrderForMapSummary): string {
  const tags = normalizeOrderTagsArray(order.tags);
  const shippingMethodTag = tags.find((tag: string) => tag.trim().toLowerCase().startsWith('shipping_method:'));
  if (shippingMethodTag) {
    const method = shippingMethodTag.split(':')[1]?.trim().toLowerCase();
    if (method === 'scooter') return 'Scooter';
    if (method === 'pickup') return 'Pickup';
    if (method === 'other-company' || method === 'other_company') return 'Other company';
  }
  return 'Shipblu';
}

function shippingRouteNameFromTags(order: OrderForMapSummary): string | null {
  const tags = normalizeOrderTagsArray(order.tags);
  const routeTag = tags.find((t) => t.toLowerCase().startsWith(SHIPPING_ROUTE_TAG_PREFIX.toLowerCase()));
  if (!routeTag) return null;
  const name = routeTag.slice(SHIPPING_ROUTE_TAG_PREFIX.length).trim();
  return name || null;
}

function rushTypeFromOrder(order: OrderForMapSummary): string {
  const lineItems = order.line_items || [];
  if (lineItems.length === 0) {
    return mergeRushTypeWithPriorityMaking('Standard', analyzePriorityMakingLineItems(lineItems));
  }

  let hasRushed = false;
  let hasStandard = false;

  for (const item of lineItems) {
    const makingTimeDays = detectLegacyMakingTime([item]);
    if (makingTimeDays === 3) hasRushed = true;
    else if (makingTimeDays === 7 || makingTimeDays === null) hasStandard = true;
  }

  let legacy: 'Rushed' | 'Standard' | 'Mix';
  if (hasRushed && hasStandard) legacy = 'Mix';
  else if (hasRushed) legacy = 'Rushed';
  else legacy = 'Standard';

  return mergeRushTypeWithPriorityMaking(legacy, analyzePriorityMakingLineItems(lineItems));
}

function fulfillmentDisplayLine(order: OrderForMapSummary): string | null {
  const fulfillments = order.fulfillments;
  if (!fulfillments || fulfillments.length === 0) return null;
  const withStatus = fulfillments
    .filter((f) => f.displayStatus)
    .sort((a, b) => {
      const aDate = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const bDate = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return bDate - aDate;
    });
  const raw = withStatus[0]?.displayStatus;
  if (!raw) return null;

  const statusMap: Record<string, string> = {
    IN_TRANSIT: 'In transit',
    OUT_FOR_DELIVERY: 'Out for delivery',
    ATTEMPTED_DELIVERY: 'Attempted delivery',
    DELAYED: 'Delayed',
    FAILED_DELIVERY: 'Failed delivery',
    DELIVERED: 'Delivered',
    TRACKING_ADDED: 'Tracking added',
    FULFILLED: 'Tracking added',
    NOT_DELIVERED: 'Not delivered',
    NO_STATUS: 'No carrier status',
  };
  return statusMap[raw] || raw.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatMoneyEgp(amount: string): string {
  const n = parseFloat(amount || '0');
  return new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency: 'EGP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatFinancialStatus(s: string): string {
  if (!s) return '';
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export type OrderMapSummary = {
  orderName: string;
  customerLine: string;
  phone: string;
  addressLine: string;
  totalFormatted: string;
  financialLine: string;
  workflow: { label: string; chipClass: string };
  daysLine: string;
  rushLine: string;
  shippingMethod: string;
  routeName: string | null;
  fulfillmentLine: string | null;
  lineItemPreview: string;
  extraItemCount: number;
};

export function buildOrderMapSummary(order: OrderForMapSummary): OrderMapSummary {
  const customerLine = [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(' ').trim() || '—';
  const phone = (order.customer?.phone || '').trim();
  const addr = order.shipping_address;
  const addressLine = [addr?.address1, addr?.city, addr?.province].filter(Boolean).join(' · ') || '—';

  const items = order.line_items || [];
  const previewParts: string[] = [];
  let count = 0;
  for (const item of items) {
    const label = item.variant_title ? `${item.title} (${item.variant_title})` : item.title;
    const piece = `${item.quantity}× ${label}`;
    if (count < 2) previewParts.push(piece);
    count += 1;
  }
  const extraItemCount = Math.max(0, items.length - 2);
  const lineItemPreview = previewParts.join(' · ') || '—';

  const days = calculateOrderDaysLeft(order);
  const wf = workflowStatus(order);
  const fulfillmentLine = fulfillmentDisplayLine(order);

  return {
    orderName: order.name || `#${order.id}`,
    customerLine,
    phone,
    addressLine,
    totalFormatted: formatMoneyEgp(order.total_price),
    financialLine: formatFinancialStatus(order.financial_status || ''),
    workflow: wf,
    daysLine: daysLeftLabel(days),
    rushLine: rushTypeFromOrder(order),
    shippingMethod: shippingMethodFromTags(order),
    routeName: shippingRouteNameFromTags(order),
    fulfillmentLine,
    lineItemPreview,
    extraItemCount,
  };
}

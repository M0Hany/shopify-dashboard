/** Workflow status tags cleared when marking orders paid + fulfilled in bulk. */
const WORKFLOW_STATUS_TAGS = new Set([
  'order_ready',
  'customer_confirmed',
  'ready_to_ship',
  'ready-to-ship',
  'shipped',
]);

const SHIPMENT_DATE_TAG_PREFIXES = ['shipped_date:', 'shipping_date:'];

export function isWorkflowStatusTag(tag: string): boolean {
  return WORKFLOW_STATUS_TAGS.has(tag.trim().toLowerCase());
}

export function isShipmentDateTag(tag: string): boolean {
  const normalized = tag.trim().toLowerCase();
  return SHIPMENT_DATE_TAG_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function stripWorkflowStatusTags(tags: string[]): string[] {
  return tags.filter((tag) => !isWorkflowStatusTag(tag));
}

/** Remove pipeline/shipment tags so bulk import moves orders to paid/fulfilled tabs. */
export function stripTagsForBulkPaidFulfillment(tags: string[]): string[] {
  return tags.filter((tag) => !isWorkflowStatusTag(tag) && !isShipmentDateTag(tag));
}

/** Workflow status tags cleared when marking orders paid + fulfilled in bulk. */
const WORKFLOW_STATUS_TAGS = new Set([
  'order_ready',
  'customer_confirmed',
  'ready_to_ship',
  'ready-to-ship',
  'shipped',
]);

export function isWorkflowStatusTag(tag: string): boolean {
  return WORKFLOW_STATUS_TAGS.has(tag.trim().toLowerCase());
}

export function stripWorkflowStatusTags(tags: string[]): string[] {
  return tags.filter((tag) => !isWorkflowStatusTag(tag));
}

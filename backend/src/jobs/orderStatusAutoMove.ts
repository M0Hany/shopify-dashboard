import { shopifyService } from '../services/shopify';
import { logger } from '../utils/logger';
import { discordNotificationService } from '../services/discordNotifications';

/**
 * Extracts date from a tag like "order_ready_date:2025-01-01"
 */
function extractDateFromTag(tag: string, prefix: string): Date | null {
  if (!tag.startsWith(prefix)) return null;
  const dateStr = tag.substring(prefix.length);
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Calculates days between two dates (ignoring time)
 */
function daysBetween(date1: Date, date2: Date): number {
  const d1 = new Date(date1);
  d1.setHours(0, 0, 0, 0);
  const d2 = new Date(date2);
  d2.setHours(0, 0, 0, 0);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Checks if order has customer_confirmed tag
 */
function hasCustomerConfirmed(tags: string[]): boolean {
  return tags.some(tag => tag.trim().toLowerCase() === 'customer_confirmed');
}

/**
 * Auto-move orders from order_ready to on_hold after 2 days without confirmation
 */
async function moveOrderReadyToOnHold(): Promise<void> {
  try {
    logger.info('Starting auto-move: order_ready → on_hold');
    
    // Get all orders with order_ready status
    const orders = await shopifyService.getOrders({
      status: 'any',
      limit: 250
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let movedCount = 0;
    let skippedCount = 0;

    for (const order of orders) {
      const tags = Array.isArray(order.tags)
        ? order.tags.map((t: string) => t.trim())
        : typeof order.tags === 'string'
          ? order.tags.split(',').map((t: string) => t.trim())
          : [];

      // Check if order has order_ready status
      const hasOrderReady = tags.some(tag => tag.trim().toLowerCase() === 'order_ready');
      if (!hasOrderReady) continue;

      // Skip if already confirmed
      if (hasCustomerConfirmed(tags)) {
        skippedCount++;
        continue;
      }

      // Find order_ready_date tag
      const orderReadyDateTag = tags.find(tag => tag.toLowerCase().startsWith('order_ready_date:'));
      if (!orderReadyDateTag) {
        // Order is order_ready but has no date tag - skip for now
        // (might be an old order before we added date tracking)
        skippedCount++;
        continue;
      }

      const orderReadyDate = extractDateFromTag(orderReadyDateTag, 'order_ready_date:');
      if (!orderReadyDate) {
        skippedCount++;
        continue;
      }

      const daysSinceReady = daysBetween(orderReadyDate, today);
      
      // Move to on_hold if 2+ days old
      if (daysSinceReady >= 2) {
        // Check if already in on_hold
        const isOnHold = tags.some(tag => tag.trim().toLowerCase() === 'on_hold');
        if (isOnHold) {
          skippedCount++;
          continue;
        }

        // Remove order_ready tag, add on_hold tag
        const statusTags = ['order_ready', 'on_hold', 'customer_confirmed', 'ready_to_ship', 'shipped', 'fulfilled', 'cancelled'];
        let filtered = tags.filter((tag: string) => {
          const trimmed = tag.trim().toLowerCase();
          return !statusTags.some(st => st.trim().toLowerCase() === trimmed);
        });

        // Add on_hold tag
        filtered.push('on_hold');
        
        // Add moved_to_on_hold date tag
        const todayStr = today.toISOString().split('T')[0];
        filtered = filtered.filter(tag => !tag.toLowerCase().startsWith('moved_to_on_hold:'));
        filtered.push(`moved_to_on_hold:${todayStr}`);
        
        // Add on_hold_reason tag
        filtered = filtered.filter(tag => !tag.toLowerCase().startsWith('on_hold_reason:'));
        filtered.push('on_hold_reason:no_confirmation');

        // Keep order_ready_date for history
        if (!filtered.some(tag => tag === orderReadyDateTag)) {
          filtered.push(orderReadyDateTag);
        }

        // Check if Discord notification was already sent (check for tag)
        const discordNotifiedTag = tags.find(tag => tag.toLowerCase().startsWith('discord_notified_on_hold:'));
        if (!discordNotifiedTag) {
          // Get customer name for notification
          const customerName = order.customer 
            ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() || 'N/A'
            : 'N/A';
          
          // Send Discord notification (non-blocking)
          discordNotificationService.notifyOrderStatusChange({
            orderId: order.id,
            orderName: order.name,
            customerName,
            previousStatus: 'order_ready',
            newStatus: 'on_hold',
            updatedBy: 'Automated System (2 days without confirmation)'
          }).catch(err => {
            logger.error('Failed to send Discord notification for on_hold status', {
              error: err,
              orderId: order.id,
              orderName: order.name
            });
          });

          // Add tag to mark notification as sent
          const todayStr = today.toISOString().split('T')[0];
          filtered = filtered.filter(tag => !tag.toLowerCase().startsWith('discord_notified_on_hold:'));
          filtered.push(`discord_notified_on_hold:${todayStr}`);
        }

        await shopifyService.updateOrderTags(order.id.toString(), filtered);
        
        logger.info('Moved order to on_hold', {
          orderId: order.id,
          orderName: order.name,
          daysSinceReady,
          orderReadyDate: orderReadyDate.toISOString().split('T')[0]
        });

        movedCount++;
      }
    }

    logger.info('Completed auto-move: order_ready → on_hold', {
      movedCount,
      skippedCount
    });
  } catch (error) {
    logger.error('Error in auto-move: order_ready → on_hold', { error });
    throw error;
  }
}

/**
 * Auto-move orders from on_hold to cancelled after 2 more days (4 days total)
 */
async function moveOnHoldToCancelled(): Promise<void> {
  try {
    logger.info('Starting auto-move: on_hold → cancelled');
    
    // Get all orders with on_hold status
    const orders = await shopifyService.getOrders({
      status: 'any',
      limit: 250
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let movedCount = 0;
    let skippedCount = 0;

    for (const order of orders) {
      const tags = Array.isArray(order.tags)
        ? order.tags.map((t: string) => t.trim())
        : typeof order.tags === 'string'
          ? order.tags.split(',').map((t: string) => t.trim())
          : [];

      // Check if order has on_hold status
      const isOnHold = tags.some(tag => tag.trim().toLowerCase() === 'on_hold');
      if (!isOnHold) continue;

      // Skip if already confirmed
      if (hasCustomerConfirmed(tags)) {
        skippedCount++;
        continue;
      }

      // Find moved_to_on_hold date tag
      const movedToOnHoldTag = tags.find(tag => tag.toLowerCase().startsWith('moved_to_on_hold:'));
      if (!movedToOnHoldTag) {
        // Order is on_hold but has no date tag - skip for now
        skippedCount++;
        continue;
      }

      const movedToOnHoldDate = extractDateFromTag(movedToOnHoldTag, 'moved_to_on_hold:');
      if (!movedToOnHoldDate) {
        skippedCount++;
        continue;
      }

      const daysSinceOnHold = daysBetween(movedToOnHoldDate, today);
      
      // Move to cancelled if 2+ days in on_hold (4 days total from order_ready)
      if (daysSinceOnHold >= 2) {
        // Check if already cancelled
        const isCancelled = tags.some(tag => tag.trim().toLowerCase() === 'cancelled');
        if (isCancelled) {
          skippedCount++;
          continue;
        }

        // Remove on_hold tag, add cancelled tag
        const statusTags = ['order_ready', 'on_hold', 'customer_confirmed', 'ready_to_ship', 'shipped', 'fulfilled', 'cancelled'];
        let filtered = tags.filter((tag: string) => {
          const trimmed = tag.trim().toLowerCase();
          return !statusTags.some(st => st.trim().toLowerCase() === trimmed);
        });

        // Add cancelled tag
        filtered.push('cancelled');
        
        // Add cancelled_date tag
        const todayStr = today.toISOString().split('T')[0];
        filtered = filtered.filter(tag => !tag.toLowerCase().startsWith('cancelled_date:'));
        filtered.push(`cancelled_date:${todayStr}`);
        
        // Add no_reply_cancelled tag for highlighting
        if (!filtered.some(tag => tag.trim().toLowerCase() === 'no_reply_cancelled')) {
          filtered.push('no_reply_cancelled');
        }

        // Keep history tags
        const orderReadyDateTag = tags.find(tag => tag.toLowerCase().startsWith('order_ready_date:'));
        if (orderReadyDateTag && !filtered.some(tag => tag === orderReadyDateTag)) {
          filtered.push(orderReadyDateTag);
        }
        if (!filtered.some(tag => tag === movedToOnHoldTag)) {
          filtered.push(movedToOnHoldTag);
        }
        const onHoldReasonTag = tags.find(tag => tag.toLowerCase().startsWith('on_hold_reason:'));
        if (onHoldReasonTag && !filtered.some(tag => tag === onHoldReasonTag)) {
          filtered.push(onHoldReasonTag);
        }

        // Check if Discord notification was already sent (check for tag)
        const discordNotifiedTag = tags.find(tag => tag.toLowerCase().startsWith('discord_notified_cancelled:'));
        if (!discordNotifiedTag) {
          // Get customer name for notification
          const customerName = order.customer 
            ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() || 'N/A'
            : 'N/A';
          
          // Send Discord notification (non-blocking)
          discordNotificationService.notifyOrderStatusChange({
            orderId: order.id,
            orderName: order.name,
            customerName,
            previousStatus: 'on_hold',
            newStatus: 'cancelled',
            updatedBy: 'Automated System (4 days total without confirmation)'
          }).catch(err => {
            logger.error('Failed to send Discord notification for cancelled status', {
              error: err,
              orderId: order.id,
              orderName: order.name
            });
          });

          // Add tag to mark notification as sent
          const todayStr = today.toISOString().split('T')[0];
          filtered = filtered.filter(tag => !tag.toLowerCase().startsWith('discord_notified_cancelled:'));
          filtered.push(`discord_notified_cancelled:${todayStr}`);
        }

        await shopifyService.updateOrderTags(order.id.toString(), filtered);
        
        logger.info('Moved order to cancelled (no reply)', {
          orderId: order.id,
          orderName: order.name,
          daysSinceOnHold,
          movedToOnHoldDate: movedToOnHoldDate.toISOString().split('T')[0]
        });

        movedCount++;
      }
    }

    logger.info('Completed auto-move: on_hold → cancelled', {
      movedCount,
      skippedCount
    });
  } catch (error) {
    logger.error('Error in auto-move: on_hold → cancelled', { error });
    throw error;
  }
}

/**
 * Main function to run both auto-move checks
 */
export async function runOrderStatusAutoMove(): Promise<void> {
  try {
    await moveOrderReadyToOnHold();
    await moveOnHoldToCancelled();
  } catch (error) {
    logger.error('Error in order status auto-move job', { error });
    throw error;
  }
}

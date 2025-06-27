import { CronJob } from 'cron';
import { ShippingService } from '../services/shipping/ShippingService';
import { logger } from '../utils/logger';
import { shippingQueue } from './queue';

const shippingService = ShippingService.getInstance();

// Run every 30 minutes
const CRON_SCHEDULE = '*/30 * * * *';

export const startAddressTagChecker = (): void => {
  const job = new CronJob(
    CRON_SCHEDULE,
    async () => {
      logger.info('Starting address tag check job');
      try {
        await processUntaggedOrders();
        logger.info('Completed address tag check job');
      } catch (error) {
        logger.error('Error in address tag check job:', error);
      }
    },
    null,
    false,
    'Africa/Cairo' // Use Cairo timezone
  );

  job.start();
  logger.info('Address tag checker job scheduled');
};

// Process untagged orders immediately when server starts
export async function scheduleAddressTagCheck() {
  try {
    logger.info('Running initial address tag check');
    await processUntaggedOrders();
    logger.info('Initial address tag check completed');
  } catch (error) {
    logger.error('Failed to run initial address tag check:', error);
  }
}

// Helper function to process untagged orders
async function processUntaggedOrders() {
  try {
    logger.info('Starting to process untagged orders');
    const result = await shippingService.processUntaggedOrders();
    logger.info('Untagged orders processing complete', { 
      successful: result.successful,
      failed: result.failed,
      errors: result.errors
    });
    return result;
  } catch (error) {
    logger.error('Error processing untagged orders:', error);
    throw error;
  }
} 
import { CronJob } from 'cron';
import { ShippingStatusChecker } from '../services/shipping/ShippingStatusChecker';
import { logger } from '../utils/logger';
import { shippingQueue } from './queue';
import { ShippingService } from '../services/shipping/ShippingService';

const shippingService = ShippingService.getInstance();
const statusChecker = new ShippingStatusChecker();

// Run every 30 minutes
const CRON_SCHEDULE = '*/30 * * * *';

export const startShippingStatusChecker = (): void => {
  const job = new CronJob(
    CRON_SCHEDULE,
    async () => {
      logger.info('Starting shipping status check job');
      try {
        await ShippingStatusChecker.checkAndUpdateStatuses();
        logger.info('Completed shipping status check job');
      } catch (error) {
        logger.error('Error in shipping status check job:', error);
      }
    },
    null,
    false,
    'Africa/Cairo' // Use Cairo timezone
  );

  job.start();
  logger.info('Shipping status checker job scheduled');
};

// Run every 30 minutes
export async function scheduleShippingStatusCheck() {
  try {
    await ShippingStatusChecker.checkAndUpdateStatuses();
    logger.info('Shipping status check completed');
  } catch (error) {
    logger.error('Failed to run shipping status check:', error);
  }
}

// Process untagged orders every 30 minutes
export async function scheduleUntaggedOrdersCheck() {
  try {
    const job = await shippingQueue.add(
      'process-untagged-orders',
      {},
      {
        repeat: {
          every: 30 * 60 * 1000, // 30 minutes
        },
      }
    );
    logger.info('Scheduled untagged orders check job', { jobId: job.id });
  } catch (error) {
    logger.error('Failed to schedule untagged orders check job:', error);
  }
}

// Add the job processor to the queue
shippingQueue.process('process-untagged-orders', async (job) => {
  try {
    logger.info('Processing untagged orders', { jobId: job.id });
    const result = await shippingService.processUntaggedOrders();
    logger.info('Untagged orders processing complete', { 
      jobId: job.id,
      successful: result.successful,
      failed: result.failed,
      errors: result.errors
    });
    return result;
  } catch (error) {
    logger.error('Error processing untagged orders:', error);
    throw error;
  }
}); 
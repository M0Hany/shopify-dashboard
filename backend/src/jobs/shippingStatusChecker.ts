import { CronJob } from 'cron';
import { ShippingStatusChecker } from '../services/shipping/ShippingStatusChecker';
import { logger } from '../utils/logger';

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
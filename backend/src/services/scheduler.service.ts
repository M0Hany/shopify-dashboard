import { CronJob } from 'cron';
import { logger } from '../utils/logger';
import { OrderConfirmationService } from './orderConfirmation.service';
import { runOrderStatusAutoMove } from '../jobs/orderStatusAutoMove';

const CRON_TIMEZONE = 'Africa/Cairo';

/**
 * SchedulerService runs recurring cron jobs. Additional jobs started from index.ts:
 * - startShippingStatusChecker() — ShipBlu delivery status, every 30 min
 */
export class SchedulerService {
  private static instance: SchedulerService;
  private jobs: CronJob[] = [];
  private orderConfirmationService: OrderConfirmationService;

  private constructor() {
    this.orderConfirmationService = OrderConfirmationService.getInstance();
    this.initializeJobs();
  }

  public static getInstance(): SchedulerService {
    if (!SchedulerService.instance) {
      SchedulerService.instance = new SchedulerService();
    }
    return SchedulerService.instance;
  }

  private initializeJobs() {
    // Pending orders: schedule WhatsApp confirmation for orders without confirmation — every 30 min
    this.addJob('*/30 * * * *', this.checkPendingOrders);

    // Auto-move orders: order_ready → on_hold (2 days) → cancelled (2 more days) — every 6 hours
    this.addJob('0 */6 * * *', this.runOrderStatusAutoMove);

    // Daily cleanup at midnight Cairo time (placeholder for future logic)
    this.addJob('0 0 * * *', this.dailyCleanup);
  }

  private addJob(cronTime: string, callback: () => Promise<void>) {
    const job = new CronJob(
      cronTime,
      async () => {
        try {
          await callback.call(this);
        } catch (error) {
          logger.error('Scheduled job failed', { 
            cronTime, 
            error 
          });
        }
      },
      null,
      true,
      CRON_TIMEZONE
    );

    this.jobs.push(job);
  }

  private async checkPendingOrders(): Promise<void> {
    logger.info('Starting pending orders check');
    try {
      await this.orderConfirmationService.checkPendingOrders();
      logger.info('Completed pending orders check');
    } catch (error) {
      logger.error('Error checking pending orders:', error);
    }
  }

  private async runOrderStatusAutoMove(): Promise<void> {
    logger.info('Starting order status auto-move job');
    try {
      await runOrderStatusAutoMove();
      logger.info('Completed order status auto-move job');
    } catch (error) {
      logger.error('Error in order status auto-move job:', error);
    }
  }

  private async dailyCleanup() {
    logger.info('Running daily cleanup');
    // Add cleanup logic
  }

  public startAll() {
    this.jobs.forEach(job => job.start());
    logger.info('All scheduled jobs started');
  }

  public stopAll() {
    this.jobs.forEach(job => job.stop());
    logger.info('All scheduled jobs stopped');
  }
}

export const schedulerService = SchedulerService.getInstance(); 
import { CronJob } from 'cron';
import { logger } from '../utils/logger';
import { statusQueue, shippingQueue } from '../jobs/queue';
import { OrderConfirmationService } from './orderConfirmation.service';
import { runOrderStatusAutoMove } from '../jobs/orderStatusAutoMove';

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
    // Check for rescheduled deliveries every hour
    this.addJob('0 * * * *', this.checkRescheduledDeliveries);

    // Check shipping statuses every 30 minutes
    this.addJob('*/30 * * * *', this.updateShippingStatuses);

    // Check pending orders every 30 minutes
    this.addJob('*/30 * * * *', this.checkPendingOrders);

    // Auto-move orders: order_ready → on_hold → cancelled (runs every 6 hours)
    this.addJob('0 */6 * * *', this.runOrderStatusAutoMove);

    // Daily cleanup at midnight
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
      true
    );

    this.jobs.push(job);
  }

  private async checkRescheduledDeliveries() {
    logger.info('Checking for rescheduled deliveries');
    // Add logic to check and process rescheduled deliveries
  }

  private async updateShippingStatuses() {
    logger.info('Updating shipping statuses');
    // Add logic to update shipping statuses
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
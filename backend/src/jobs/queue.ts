import Queue from 'bull';
import { config } from '../config';
import { logger } from '../utils/logger';

const queuesEnabled = process.env.VERCEL !== '1';

function createStubQueue(): Queue.Queue {
  const stub = {
    add: async () => ({ id: 'stub' }) as Queue.Job,
    process: () => stub,
    on: () => stub,
    clean: async () => [],
  };
  return stub as unknown as Queue.Queue;
}

function createRealQueue(name: string): Queue.Queue {
  return new Queue(name, {
    redis: {
      host: config.redis.host,
      port: config.redis.port,
      maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
      retryStrategy: config.redis.retryStrategy,
    },
  });
}

export const shippingQueue = queuesEnabled
  ? createRealQueue('shipping-operations')
  : createStubQueue();

export const statusQueue = queuesEnabled
  ? createRealQueue('status-updates')
  : createStubQueue();

export const orderConfirmationQueue = queuesEnabled
  ? createRealQueue('order-confirmations')
  : createStubQueue();

export const reviewMessageQueue = queuesEnabled
  ? createRealQueue('review-messages')
  : createStubQueue();

if (queuesEnabled) {
  const { statusService } = require('../services/status.service');

  statusQueue.process(async (job) => {
    try {
      logger.info('Processing status change job', { jobId: job.id, data: job.data });
      await statusService.handleStatusChange(job.data);
      logger.info('Status change job completed', { jobId: job.id });
    } catch (error) {
      logger.error('Error processing status change job', { jobId: job.id, error });
      throw error;
    }
  });

  shippingQueue.process(async (job) => {
    try {
      logger.info('Processing shipping job', { jobId: job.id, data: job.data });
      logger.info('Shipping job completed', { jobId: job.id });
    } catch (error) {
      logger.error('Error processing shipping job', { jobId: job.id, error });
      throw error;
    }
  });

  orderConfirmationQueue.process('send-order-confirmation', async (job) => {
    try {
      logger.info('Processing order confirmation job', { jobId: job.id, data: job.data });
      const { OrderConfirmationService } = await import('../services/orderConfirmation.service');
      const orderConfirmationService = OrderConfirmationService.getInstance();
      await orderConfirmationService.sendDelayedConfirmation(job.data);
      logger.info('Order confirmation job completed', { jobId: job.id });
    } catch (error) {
      logger.error('Error processing order confirmation job', { jobId: job.id, error });
      throw error;
    }
  });

  reviewMessageQueue.process('send-review', async (job) => {
    try {
      const { FulfilledReviewMessagingService } = await import(
        '../services/fulfilledReviewMessaging.service'
      );
      await FulfilledReviewMessagingService.getInstance().sendReviewMessage(job.data);
      logger.info('Review message job completed', { jobId: job.id });
    } catch (error) {
      logger.error('Review message job failed', { jobId: job.id, error });
      throw error;
    }
  });

  let hasLoggedShippingError = false;
  let hasLoggedStatusError = false;
  let hasLoggedOrderConfirmationError = false;
  let hasLoggedReviewMessageError = false;

  shippingQueue.on('error', (error) => {
    if (!hasLoggedShippingError) {
      logger.error('Shipping queue error:', error);
      hasLoggedShippingError = true;
    }
  });

  statusQueue.on('error', (error) => {
    if (!hasLoggedStatusError) {
      logger.error('Status queue error:', error);
      hasLoggedStatusError = true;
    }
  });

  shippingQueue.on('ready', () => {
    hasLoggedShippingError = false;
    logger.info('Shipping queue connected successfully');
  });

  statusQueue.on('ready', () => {
    hasLoggedStatusError = false;
    logger.info('Status queue connected successfully');
  });

  orderConfirmationQueue.on('error', (error) => {
    if (!hasLoggedOrderConfirmationError) {
      logger.error('Order confirmation queue error:', error);
      hasLoggedOrderConfirmationError = true;
    }
  });

  orderConfirmationQueue.on('ready', () => {
    hasLoggedOrderConfirmationError = false;
    logger.info('Order confirmation queue connected successfully');
  });

  orderConfirmationQueue.on('failed', async (job, error) => {
    if (!job || job.name !== 'send-order-confirmation') return;
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) return;

    logger.error('Order confirmation job failed permanently', {
      jobId: job.id,
      orderId: job.data?.orderId,
      error: error?.message,
    });

    try {
      const { OrderConfirmationService } = await import('../services/orderConfirmation.service');
      if (job.data?.orderId) {
        await OrderConfirmationService.getInstance().clearConfirmationScheduled(
          String(job.data.orderId)
        );
      }
    } catch (clearErr) {
      logger.error('Failed to clear confirmation_scheduled after job failure', { clearErr });
    }
  });

  shippingQueue.on('completed', (job) => {
    logger.info('Job completed', { jobId: job.id, queue: 'shipping-operations' });
  });

  statusQueue.on('completed', (job) => {
    logger.info('Job completed', { jobId: job.id, queue: 'status-updates' });
  });

  orderConfirmationQueue.on('completed', (job) => {
    logger.info('Job completed', { jobId: job.id, queue: 'order-confirmations' });
  });

  reviewMessageQueue.on('error', (error) => {
    if (!hasLoggedReviewMessageError) {
      logger.error('Review message queue error:', error);
      hasLoggedReviewMessageError = true;
    }
  });

  reviewMessageQueue.on('ready', () => {
    hasLoggedReviewMessageError = false;
    logger.info('Review message queue connected successfully');
  });

  reviewMessageQueue.on('completed', (job) => {
    logger.info('Job completed', { jobId: job.id, queue: 'review-messages' });
  });

  async function cleanupJobs() {
    await Promise.all([
      statusQueue.clean(7 * 24 * 3600 * 1000),
      shippingQueue.clean(7 * 24 * 3600 * 1000),
      orderConfirmationQueue.clean(7 * 24 * 3600 * 1000),
      reviewMessageQueue.clean(7 * 24 * 3600 * 1000),
    ]);
  }

  setInterval(cleanupJobs, 24 * 3600 * 1000);
}

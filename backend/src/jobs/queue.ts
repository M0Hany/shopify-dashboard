import Queue from 'bull';
import { logger } from '../utils/logger';
import { statusService } from '../services/status.service';
import { OrderStatus } from '../types/order';

// Queue for processing status changes
export const statusQueue = new Queue<{
  orderId: string;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  reason?: string;
}>('status-updates', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  }
});

// Queue for shipping operations
export const shippingQueue = new Queue('shipping-operations', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  }
});

// Process status changes
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

// Process shipping operations
shippingQueue.process(async (job) => {
  try {
    logger.info('Processing shipping job', { jobId: job.id, data: job.data });
    // Add shipping-specific processing logic here
    logger.info('Shipping job completed', { jobId: job.id });
  } catch (error) {
    logger.error('Error processing shipping job', { jobId: job.id, error });
    throw error;
  }
});

// Error handling
[statusQueue, shippingQueue].forEach(queue => {
  queue.on('error', (error) => {
    logger.error('Queue error', { queue: queue.name, error });
  });

  queue.on('failed', (job, error) => {
    logger.error('Job failed', { 
      queue: queue.name, 
      jobId: job.id, 
      error 
    });
  });
});

// Clean up completed jobs
async function cleanupJobs() {
  await Promise.all([
    statusQueue.clean(7 * 24 * 3600 * 1000), // 7 days
    shippingQueue.clean(7 * 24 * 3600 * 1000)
  ]);
}

// Run cleanup daily
setInterval(cleanupJobs, 24 * 3600 * 1000); 
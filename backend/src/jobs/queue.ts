import Queue from 'bull';
import { config } from '../config';
import { logger } from '../utils/logger';
import { statusService } from '../services/status.service';
import { OrderStatus } from '../types/order';

// Create queues with Redis configuration
export const shippingQueue = new Queue('shipping-operations', {
  redis: {
    host: config.redis.host,
    port: config.redis.port,
    maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
    retryStrategy: config.redis.retryStrategy
  }
});

export const statusQueue = new Queue('status-updates', {
  redis: {
    host: config.redis.host,
    port: config.redis.port,
    maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
    retryStrategy: config.redis.retryStrategy
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

// Error handling for queues
let hasLoggedShippingError = false;
let hasLoggedStatusError = false;

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

// Reset error flags when connection is successful
shippingQueue.on('ready', () => {
  hasLoggedShippingError = false;
  logger.info('Shipping queue connected successfully');
});

statusQueue.on('ready', () => {
  hasLoggedStatusError = false;
  logger.info('Status queue connected successfully');
});

// Log successful job completion
shippingQueue.on('completed', (job) => {
  logger.info('Job completed', { jobId: job.id, queue: 'shipping-operations' });
});

statusQueue.on('completed', (job) => {
  logger.info('Job completed', { jobId: job.id, queue: 'status-updates' });
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
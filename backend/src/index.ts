import 'dotenv/config';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import orders from './routes/orders';
import financeRoutes from './routes/financeRoutes';
import shippingRoutes from './routes/shipping';
import whatsappWebhook from './routes/whatsappWebhook';
import { errorHandler } from './middleware/errorHandler';
import { getConfig } from './config';
import express from 'express';
import { schedulerService } from './services/scheduler.service';
import { logger } from './utils/logger';
import { scheduleShippingStatusCheck } from './jobs/shippingStatusChecker';
import { scheduleAddressTagCheck } from './jobs/addressTagChecker';
import { CronJob } from 'cron';
import path from 'path';

const app = express();
const config = getConfig();

// Trust proxy - required for rate limiting behind reverse proxies
app.set('trust proxy', 1);

// Middleware
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
app.use(cors({
  origin: config.allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'Accept-Language',
    'Cache-Control',
    'Culture',
    'Pragma',
    'Priority'
  ],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max
});
app.use(limiter);

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/orders', orders);
app.use('/api/finance', financeRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/whatsapp', whatsappWebhook);

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'CORS test successful' });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// API route not found
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Error handling
app.use(errorHandler);

// Start the server
app.listen(config.port, async () => {
  logger.info(`Server is running on port ${config.port}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
  
  try {
    // Run initial checks
    logger.info('Running initial checks...');
    await scheduleShippingStatusCheck();
    await scheduleAddressTagCheck();
    logger.info('Initial checks completed');
    
    // Schedule recurring checks
    const shippingCron = new CronJob('*/30 * * * *', async () => {
      try {
        await scheduleShippingStatusCheck();
      } catch (error) {
        logger.error('Error in shipping status check:', error);
      }
    }, null, true, 'Africa/Cairo');
    
    const addressCron = new CronJob('*/30 * * * *', async () => {
      try {
        await scheduleAddressTagCheck();
      } catch (error) {
        logger.error('Error in address tag check:', error);
      }
    }, null, true, 'Africa/Cairo');
    
    shippingCron.start();
    addressCron.start();
    
    logger.info('Scheduled jobs started successfully');
  } catch (error) {
    logger.error('Failed to initialize scheduled jobs:', error);
  }
}); 
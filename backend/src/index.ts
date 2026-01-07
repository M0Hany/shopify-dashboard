import 'dotenv/config';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import orders from './routes/orders';
import financeRoutes from './routes/financeRoutes';
import financialRoutes from './routes/financial';
import shippingRoutes from './routes/shipping';
import whatsappWebhook from './routes/whatsappWebhook';
import discordInteractions from './routes/discordInteractions';
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

// IMPORTANT: Register Discord interactions route BEFORE json() middleware
// Discord needs raw body for signature verification
app.use('/api/discord', discordInteractions);

// JSON parsing for all other routes
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

// Specific rate limiting for orders endpoint
const ordersLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30, // 30 requests per 5 minutes for orders
  message: {
    error: 'Too many requests to orders endpoint. Please wait a few minutes before trying again.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/orders', ordersLimiter);

// Add caching headers middleware
app.use((req, res, next) => {
  // Add cache headers for GET requests
  if (req.method === 'GET') {
    res.set('Cache-Control', 'public, max-age=120'); // Cache for 2 minutes
  }
  next();
});

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/orders', orders);
app.use('/api/finance', financeRoutes);
app.use('/api/financial', financialRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/whatsapp', whatsappWebhook);
// Note: Discord interactions route is registered above, before json() middleware

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

// Start server
const PORT = config.port || 3000;

const startServer = async () => {
  try {
    // Start scheduler service
    schedulerService.startAll();
    
    // Schedule jobs
    scheduleShippingStatusCheck();
    scheduleAddressTagCheck();
    
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer(); 
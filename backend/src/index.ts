import 'dotenv/config';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import orders from './routes/orders';
import financeRoutes from './routes/financeRoutes';
import shippingRoutes from './routes/shipping';
import { errorHandler } from './middleware/errorHandler';
import { getConfig } from './config';
import express from 'express';
import { schedulerService } from './services/scheduler.service';
import { logger } from './utils/logger';

const app = express();
const config = getConfig();

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

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'CORS test successful' });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    services: {
      database: true, // Add actual check
      shipping: true, // Add actual check
      scheduler: true // Add actual check
    }
  });
});

// Error handling
app.use(errorHandler);

const port = process.env.PORT || 3000;

// Start the server
const startServer = async () => {
  try {
    // Start scheduler
    schedulerService.startAll();

    app.listen(port, () => {
      logger.info(`Server is running on port ${port}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
      
      // Verify Supabase connection
      if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
        logger.info('Supabase configuration found');
      } else {
        logger.error('Missing Supabase configuration');
        process.exit(1);
      }
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received. Starting graceful shutdown...');
      schedulerService.stopAll();
      // Add other cleanup tasks here
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer(); 
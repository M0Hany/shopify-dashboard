import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import express from 'express';
import path from 'path';
import orders from './routes/orders';
import financeRoutes from './routes/financeRoutes';
import financialRoutes from './routes/financial';
import shippingRoutes from './routes/shipping';
import whatsappWebhook from './routes/whatsappWebhook';
import whatsappWebRoutes from './routes/whatsappWeb';
import whatsappHubRoutes from './routes/whatsappHub';
import discordInteractions from './routes/discordInteractions';
import { errorHandler } from './middleware/errorHandler';
import { corsOptions, getConfig } from './config';
import { logger } from './utils/logger';

const config = getConfig();
const app = express();

app.set('trust proxy', 1);

// CORS first — required for browser preflight before any other middleware
app.use(cors(corsOptions));

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(morgan('dev'));

// Discord needs raw body for signature verification
app.use('/api/discord', discordInteractions);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
});
app.use(limiter);

const ordersLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  message: {
    error: 'Too many requests to orders endpoint. Please wait a few minutes before trying again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/orders', ordersLimiter);

app.use((req, res, next) => {
  if (req.method === 'GET') {
    res.set('Cache-Control', 'public, max-age=120');
  }
  next();
});

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

app.use('/api/orders', orders);
app.use('/api/finance', financeRoutes);
app.use('/api/financial', financialRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/whatsapp', whatsappWebhook);
app.use('/api/whatsapp/web', whatsappWebRoutes);
app.use('/api/whatsapp/hub', whatsappHubRoutes);

app.get('/api/test', (_req, res) => {
  res.json({ message: 'CORS test successful' });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy' });
});

app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

app.use(errorHandler);

export default app;

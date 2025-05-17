import 'dotenv/config';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import orders from './routes/orders';
import whatsapp from './routes/whatsapp';
import financeRoutes from './routes/financeRoutes';
import { errorHandler } from './middleware/errorHandler';
import { getConfig } from './config';
import express from 'express';

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
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max
});
app.use(limiter);

// Routes
app.use('/api/orders', orders);
app.use('/api/whatsapp', whatsapp);
app.use('/api/finance', financeRoutes);

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'CORS test successful' });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handling
app.use(errorHandler);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  
  // Verify Supabase connection
  if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    console.log('Supabase configuration found');
  } else {
    console.error('Missing Supabase configuration');
    process.exit(1);
  }
}); 
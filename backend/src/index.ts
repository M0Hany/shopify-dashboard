import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import orders from './routes/orders';
import whatsapp from './routes/whatsapp';
import { errorHandler } from './middleware/errorHandler';
import { getConfig } from './config';

// Load environment variables
dotenv.config();

const config = getConfig();
const app = express();

// CORS configuration
app.use(cors({
  origin: config.allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: false  // Set to false since we're not using cookies
}));

app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
});
app.use(limiter);

// Routes
app.use('/api/orders', orders);
app.use('/api/whatsapp', whatsapp);

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 
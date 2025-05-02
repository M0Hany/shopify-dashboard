import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import config from './config/server';
import { checkAuth } from './middleware/auth';
import { connectDB } from './services/database';
import orderRoutes from './routes/orders';

const app = express();

// Connect to MongoDB
connectDB().catch(console.error);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: config.server.corsOrigin,
  credentials: true,
}));
app.use(morgan('dev'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Protected routes
app.use('/api', checkAuth);
app.use('/api/orders', orderRoutes);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Internal Server Error',
    error: config.server.nodeEnv === 'development' ? err.message : undefined,
  });
});

// Start server
const port = config.server.port;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Environment: ${config.server.nodeEnv}`);
}); 
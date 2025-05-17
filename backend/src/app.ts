import express from 'express';
import ordersRoutes from './routes/orders';
import whatsappRoutes from './routes/whatsapp';
import financeRoutes from './routes/financeRoutes';

const app = express();

// Middleware
app.use(express.json());

// Routes
app.use('/api/orders', ordersRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/finance', financeRoutes);

export default app; 
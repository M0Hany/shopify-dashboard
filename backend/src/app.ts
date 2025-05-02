import ordersRoutes from './routes/orders';
import whatsappRoutes from './routes/whatsapp';

// Routes
app.use('/api/orders', ordersRoutes);
app.use('/api/whatsapp', whatsappRoutes); 
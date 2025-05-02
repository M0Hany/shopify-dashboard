import { Router } from 'express';
import { getOrders, getOrderById, updateOrderStatus } from '../controllers/orderController';

const router = Router();

// Order routes
router.get('/', getOrders);
router.get('/:id', getOrderById);
router.put('/:id/status', updateOrderStatus);

export default router; 
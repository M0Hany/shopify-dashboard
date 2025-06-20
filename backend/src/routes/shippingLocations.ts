import express from 'express';
import { ShippingController } from '../controllers/shippingController';

const router = express.Router();
const shippingController = new ShippingController();

// Get all locations
router.get('/', shippingController.getLocations);

// Find location IDs
router.get('/find', shippingController.findLocationIds);

export default router; 
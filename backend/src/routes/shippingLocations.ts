import { Router } from 'express';
import { ShippingController } from '../controllers/shippingController';

const router = Router();
const shippingController = new ShippingController();

// Get all shipping locations (cities, neighborhoods, and subzones)
router.get('/', shippingController.getAllLocations);

// Find location IDs by city and neighborhood names
router.get('/find', shippingController.findLocationIds);

export default router; 
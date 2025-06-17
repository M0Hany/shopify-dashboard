import { Router } from 'express';
import { ShippingService } from '../services/shipping/ShippingService';
import { OrderDTO } from '../services/shipping/types';
import { ShippingStatusChecker } from '../services/shipping/ShippingStatusChecker';
import { ShippingController } from '../controllers/shippingController';
import { logger } from '../utils/logger';

const router = Router();
const shippingService = new ShippingService();
const shippingController = new ShippingController();
const statusChecker = new ShippingStatusChecker();

// Authentication
router.post('/auth', async (req, res) => {
  try {
    const { grant_type, username, password } = req.body;
    const response = await shippingService.authenticate(username, password);
    res.json(response);
  } catch (error) {
    console.error('Error authenticating:', error);
    res.status(500).json({ error: 'Failed to authenticate' });
  }
});

// Get Packages List
router.post('/packages/list', async (req, res) => {
  try {
    const response = await shippingService.getPackagesList(req.body);
    res.json(response);
  } catch (error) {
    console.error('Error fetching packages list:', error);
    res.status(500).json({ error: 'Failed to fetch packages list' });
  }
});

// Create shipping order
router.post('/orders', async (req, res) => {
  try {
    const orderData: OrderDTO = req.body;
    const response = await shippingService.createOrder(orderData);
    res.json(response);
  } catch (error) {
    console.error('Error creating shipping order:', error);
    res.status(500).json({ error: 'Failed to create shipping order' });
  }
});

// Track package
router.get('/packages/:awb/status', async (req, res) => {
  try {
    const { awb } = req.params;
    const response = await shippingService.trackPackage(awb);
    res.json(response);
  } catch (error) {
    console.error('Error tracking package:', error);
    res.status(500).json({ error: 'Failed to track package' });
  }
});

// Get AWB
router.post('/packages/awb', async (req, res) => {
  try {
    const { barcode, referenceNumber } = req.body;
    const awbBuffer = await shippingService.getAWB(barcode, referenceNumber);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=awb-${barcode}.pdf`);
    res.send(awbBuffer);
  } catch (error) {
    console.error('Error generating AWB:', error);
    res.status(500).json({ error: 'Failed to generate AWB' });
  }
});

// Get warehouses
router.get('/warehouses', async (req, res) => {
  try {
    const warehouses = await shippingService.getWarehouses();
    res.json(warehouses);
  } catch (error) {
    console.error('Error fetching warehouses:', error);
    res.status(500).json({ error: 'Failed to fetch warehouses' });
  }
});

// Get expected charges
router.post('/charges', async (req, res) => {
  try {
    const { codValue, warehouseName, packageWeight } = req.body;
    const charges = await shippingService.getExpectedCharges(
      codValue,
      warehouseName,
      packageWeight
    );
    res.json(charges);
  } catch (error) {
    console.error('Error calculating charges:', error);
    res.status(500).json({ error: 'Failed to calculate shipping charges' });
  }
});

// Test endpoint to manually trigger shipping status check
router.post('/check-status', async (req, res) => {
  try {
    await ShippingStatusChecker.checkAndUpdateStatuses();
    res.json({ message: 'Shipping status check triggered successfully' });
  } catch (error) {
    console.error('Error triggering shipping status check:', error);
    res.status(500).json({ error: 'Failed to trigger shipping status check' });
  }
});

// Shipping locations endpoints
router.get('/locations', shippingController.getAllLocations);
router.get('/location-ids', shippingController.findLocationIds);

// Add a new route to test the GetAllPickup endpoint
router.get('/test-get-all-locations', async (req, res) => {
  try {
    const shippingService = ShippingService.getInstance();
    const result = await shippingService.getAllLocations();
    
    // Log the full data structure
    logger.info('GetAllLocations test result:', {
      success: result.success,
      message: result.message,
      dataCount: result.data?.length || 0,
      firstCity: result.data?.[0] // Log first city as sample
    });

    // Return the actual data
    res.status(200).json(result);
  } catch (error: any) {
    logger.error('Error testing GetAllLocations:', error);
    res.status(500).json({ 
      error: 'Failed to test GetAllLocations', 
      details: error?.message || 'Unknown error' 
    });
  }
});

export default router; 
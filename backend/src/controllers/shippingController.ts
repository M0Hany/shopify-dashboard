import { Request, Response } from 'express';
import { ShippingService } from '../services/shipping/ShippingService';
import { logger } from '../utils/logger';
import { GetPackagesListPayload, FilterModel, PageFilter } from '../services/shipping/types';

export class ShippingController {
  private shippingService: ShippingService;

  constructor() {
    this.shippingService = ShippingService.getInstance();
  }

  public createOrder = async (req: Request, res: Response): Promise<void> => {
    try {
      const orderData = req.body;
      const result = await this.shippingService.createOrder(orderData);
      res.json(result);
    } catch (error) {
      logger.error('Error creating shipping order:', error);
      res.status(500).json({ 
        error: 'Failed to create shipping order',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  public trackShipment = async (req: Request, res: Response): Promise<void> => {
    try {
      const { awb } = req.params;
      if (!awb) {
        res.status(400).json({ error: 'AWB number is required' });
        return;
      }
      const result = await this.shippingService.trackPackage(awb);
      res.json(result);
    } catch (error) {
      logger.error('Error tracking shipment:', error);
      res.status(500).json({ 
        error: 'Failed to track shipment',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  public getToken = async (_req: Request, res: Response): Promise<void> => {
    try {
      // Force a new token by setting the current token to null
      await this.shippingService.authenticate();
      res.json({ message: 'Token refreshed successfully' });
    } catch (error) {
      logger.error('Error refreshing token:', error);
      res.status(500).json({ 
        error: 'Failed to refresh token',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  public getPackagesList = async (req: Request, res: Response): Promise<Response> => {
    try {
      const payload = req.body as GetPackagesListPayload;
      
      // Validate required fields
      if (!payload.FilterModel?.PageFilter) {
        return res.status(400).json({ error: 'Invalid payload: FilterModel.PageFilter is required' });
      }

      const packages = await this.shippingService.getPackagesList(payload);
      return res.json(packages);
    } catch (error) {
      logger.error('Error getting packages list:', error);
      return res.status(500).json({ 
        error: 'Failed to get packages list',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  public async getLocations(req: Request, res: Response): Promise<void> {
    try {
      const locations = await this.shippingService.getAllLocations();
      res.json(locations);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch locations' });
    }
  }

  public async findLocationIds(req: Request, res: Response): Promise<void> {
    try {
      const { city, neighborhood } = req.query;
      if (!city || !neighborhood) {
        res.status(400).json({ error: 'City and neighborhood are required' });
        return;
      }

      const locationIds = await this.shippingService.findLocationIds(
        city.toString(),
        neighborhood.toString()
      );
      res.json(locationIds);
    } catch (error) {
      res.status(500).json({ error: 'Failed to find location IDs' });
    }
  }

  public async createShipment(req: Request, res: Response): Promise<void> {
    try {
      const { orderIds } = req.body;
      if (!orderIds || !Array.isArray(orderIds)) {
        res.status(400).json({ error: 'Invalid order IDs' });
        return;
      }

      const result = await this.shippingService.createShipments(orderIds);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create shipment' });
    }
  }

  public async getShippingStatus(req: Request, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const status = await this.shippingService.getShippingStatus(orderId);
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get shipping status' });
    }
  }
} 
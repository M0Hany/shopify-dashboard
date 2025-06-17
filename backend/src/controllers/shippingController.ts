import { Request, Response } from 'express';
import { ShippingService } from '../services/shipping/ShippingService';
import { logger } from '../utils/logger';

export class ShippingController {
  private shippingService: ShippingService;

  constructor() {
    this.shippingService = new ShippingService();
  }

  getAllLocations = async (req: Request, res: Response): Promise<void> => {
    try {
      const locations = await this.shippingService.getAllLocations();
      res.json(locations);
    } catch (error) {
      logger.error('Error fetching shipping locations:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch shipping locations',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  findLocationIds = async (req: Request, res: Response): Promise<void> => {
    try {
      const { cityName, neighborhoodName } = req.query;

      if (!cityName || !neighborhoodName) {
        res.status(400).json({
          success: false,
          message: 'City name and neighborhood name are required'
        });
        return;
      }

      const locationIds = await this.shippingService.findLocationIds(
        cityName.toString(),
        neighborhoodName.toString()
      );

      res.json({
        success: true,
        data: locationIds
      });
    } catch (error) {
      logger.error('Error finding location IDs:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to find location IDs',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
} 
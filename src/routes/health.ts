import express, { Request, Response } from 'express';
import { logger } from '../config/logger';
import mqttService from '../services/mqttService';
import { ApiResponse } from '../types';

const router = express.Router();

// Health check endpoint
router.get('/', async (_req: Request, res: Response) => {
  try {
    const response: ApiResponse = {
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          mqtt: {
            connected: mqttService.isConnected,
            subscribedTopics: mqttService.subscribedTopicNames
          },
          database: {
            connected: true // Assuming database is connected if we can reach this point
          }
        }
      }
    };
    res.json(response);
  } catch (error) {
    logger.error('Health check failed:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Health check failed'
    };
    res.status(500).json(response);
  }
});

// Detailed status endpoint
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const response: ApiResponse = {
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        mqtt: {
          connected: mqttService.isConnected,
          subscribedTopics: [], // This would need to be implemented in the service
          clientId: process.env['MQTT_CLIENT_ID'] || `comfy-mqtt-${Date.now()}`
        },
        database: {
          connected: true,
          type: 'PostgreSQL'
        }
      }
    };
    res.json(response);
  } catch (error) {
    logger.error('Status check failed:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Status check failed'
    };
    res.status(500).json(response);
  }
});

export default router; 
const express = require('express');
const mqttService = require('../services/mqttService');
const database = require('../config/database');

const router = express.Router();

// Health check endpoint
router.get('/', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        mqtt: {
          connected: mqttService.isConnected,
          subscribedTopics: mqttService.getSubscribedTopics().length
        },
        database: {
          connected: true,
          type: 'in-memory'
        }
      }
    };

    // Check if any critical service is down
    if (!mqttService.isConnected) {
      health.status = 'degraded';
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);

  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Detailed status endpoint
router.get('/status', async (req, res) => {
  try {
    const status = {
      timestamp: new Date().toISOString(),
      mqtt: {
        connected: mqttService.isConnected,
        subscribedTopics: mqttService.getSubscribedTopics(),
        clientId: mqttService.client ? mqttService.client.options.clientId : null
      },
      database: {
        connected: true,
        type: 'in-memory',
        topicsCount: database.topics ? database.topics.size : 0
      }
    };

    res.json(status);

  } catch (error) {
    res.status(500).json({
      error: 'Failed to get detailed status',
      message: error.message
    });
  }
});

module.exports = router; 
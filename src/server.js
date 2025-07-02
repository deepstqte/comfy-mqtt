require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');

const logger = require('./config/logger');
const database = require('./config/database');
const mqttService = require('./services/mqttService');
const topicsRouter = require('./routes/topics');
const healthRouter = require('./routes/health');

const app = express();
const PORT = process.env.PORT || 3000;

// Create necessary directories
const dataDir = path.join(__dirname, '../data');
const logsDir = path.join(__dirname, '../logs');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Routes
app.use('/api/topics', topicsRouter);
app.use('/api/health', healthRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Comfy MQTT',
    version: '1.0.0',
    description: 'A REST API layer on top of MQTT with database storage and payload validation',
    endpoints: {
      topics: '/api/topics',
      health: '/api/health'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  await shutdown();
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  await shutdown();
});

async function shutdown() {
  try {
    mqttService.disconnect();
    database.close();
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Initialize and start server
async function startServer() {
  try {
    console.log('🚀 Starting Comfy MQTT server...');
    console.log('Environment variables:', {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      MQTT_HOST: process.env.MQTT_HOST,
      MQTT_PORT: process.env.MQTT_PORT,
      MQTT_USERNAME: process.env.MQTT_USERNAME ? '***' : undefined,
      MQTT_PASSWORD: process.env.MQTT_PASSWORD ? '***' : undefined
    });

    // Initialize database
    console.log('📊 Initializing database...');
    await database.initialize();
    logger.info('Database initialized successfully');

    // Connect to MQTT broker
    console.log('🔌 Connecting to MQTT broker...');
    const mqttConfig = {
      host: process.env.MQTT_HOST || 'localhost',
      port: parseInt(process.env.MQTT_PORT) || 1883,
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      clientId: process.env.MQTT_CLIENT_ID || `comfy-mqtt-${Date.now()}`
    };

    console.log('MQTT Config:', { ...mqttConfig, username: mqttConfig.username ? '***' : undefined, password: mqttConfig.password ? '***' : undefined });

    await mqttService.connect(mqttConfig);
    logger.info('MQTT service connected successfully');

    // Resubscribe to existing topics from database
    console.log('📡 Resubscribing to existing topics...');
    const topics = await database.getTopics();
    console.log('Topics: ', topics);
    for (const topic of topics) {
      try {
        await mqttService.subscribeToTopic(topic.name, topic.schema);
        logger.info(`Resubscribed to topic: ${topic.name}`);
      } catch (error) {
        logger.error(`Failed to resubscribe to topic ${topic.name}:`, error);
      }
    }

    // Start HTTP server
    console.log(`🌐 Starting HTTP server on port ${PORT}...`);
    app.listen(PORT, () => {
      logger.info(`Comfy MQTT server running on port ${PORT}`);
      logger.info(`Health check available at http://localhost:${PORT}/api/health`);
      console.log('✅ Server started successfully!');
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer(); 
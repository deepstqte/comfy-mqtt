import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { logger } from './config/logger';
import database from './config/database';
import mqttService from './services/mqttService';
import topicsRouter from './routes/topics';
import healthRouter from './routes/health';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env['PORT'] || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Routes
app.use('/api/topics', topicsRouter);
app.use('/api/health', healthRouter);

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    message: 'Comfy MQTT API',
    version: '1.0.0',
    endpoints: {
      topics: '/api/topics',
      health: '/api/health'
    }
  });
});

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use('*', (_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Close database connections
    database.close();
    
    // Disconnect MQTT
    await mqttService.disconnect();
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Initialize and start server
const startServer = async () => {
  try {
    // Initialize database
    await database.initialize();
    logger.info('Database initialized successfully');
    
    // Initialize MQTT service
    await mqttService.connect();
    logger.info('MQTT service initialized successfully');
    
    // Restore subscriptions from database
    await restoreSubscriptions();
    logger.info('Subscriptions restored from database');
    
    // Start server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Restore MQTT subscriptions from database
const restoreSubscriptions = async () => {
  try {
    const topics = await database.getTopics();
    logger.info(`Found ${topics.length} topics in database`);
    
    for (const topic of topics) {
      try {
        await mqttService.subscribeToTopic(topic.name, topic.schema);
        logger.info(`Restored subscription to topic: ${topic.name}`);
      } catch (error) {
        logger.error(`Failed to restore subscription to topic ${topic.name}:`, error);
      }
    }
  } catch (error) {
    logger.error('Error restoring subscriptions:', error);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start the server
startServer(); 
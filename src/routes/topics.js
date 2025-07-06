const express = require('express');
const Joi = require('joi');
const logger = require('../config/logger');
const database = require('../config/database');
const mqttService = require('../services/mqttService');

const router = express.Router();

// Validation schemas
const topicSchema = Joi.object({
  name: Joi.string().required().min(1).max(255),
  schema: Joi.object().required(),
  useDedicatedTable: Joi.boolean().default(false)
});

const messageSchema = Joi.object({
  payload: Joi.object().required()
});

// Get all configured topics
router.get('/', async (req, res) => {
  try {
    const topics = await database.getTopics();
    res.json({
      success: true,
      data: topics,
      count: topics.length
    });
  } catch (error) {
    logger.error('Error getting topics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve topics'
    });
  }
});

// Configure a new topic
router.post('/', async (req, res) => {
  try {
    const { error, value } = topicSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: `Validation error: ${error.details[0].message}`
      });
    }

    const { name, schema, useDedicatedTable } = value;

    // Add topic to database
    await database.addTopic(name, schema, useDedicatedTable);

    // Subscribe to MQTT topic
    await mqttService.subscribeToTopic(name, schema);

    logger.info(`Topic ${name} configured successfully`);
    res.status(201).json({
      success: true,
      message: `Topic ${name} configured successfully`,
      data: { name, schema, useDedicatedTable }
    });

  } catch (error) {
    logger.error('Error configuring topic:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to configure topic'
    });
  }
});

// Get messages for a specific topic
router.get('/*/messages', async (req, res) => {
  try {
    const topicName = req.params[0]; // Use params[0] for wildcard routes
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    const offset = parseInt(req.query.offset) || 0;
    const format = req.query.format || 'json'; // 'json' or 'csv'
    const order = req.query.order || 'asc'; // 'asc' or 'desc'
    
    // Validate order parameter
    if (order !== 'asc' && order !== 'desc') {
      return res.status(400).json({
        success: false,
        error: 'Order parameter must be "asc" or "desc"'
      });
    }

    // Check if topic exists
    const topic = await database.getTopic(topicName);
    if (!topic) {
      return res.status(404).json({
        success: false,
        error: `Topic ${topicName} not found`
      });
    }

    const messages = await database.getMessages(topicName, limit, offset, format === 'csv', order);
    
    if (format === 'csv') {
      try {
        console.log('CSV request for topic:', topicName);
        console.log('Topic data:', topic);
        console.log('Messages count:', messages.length);
        
        // Generate CSV
        const csv = generateCSV(messages, topic.schema, topic.use_dedicated_table);
        
        console.log('CSV generated, length:', csv.length);
        
        // Set headers for CSV download
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${topicName.replace(/[^a-zA-Z0-9]/g, '_')}_messages.csv"`);
        res.setHeader('Cache-Control', 'no-cache');
        
        // Send CSV response
        res.send(csv);
        console.log('CSV response sent');
        return; // Important: return here to prevent JSON response
      } catch (csvError) {
        console.error('CSV generation error:', csvError);
        logger.error(`Error generating CSV for topic ${topicName}:`, csvError);
        return res.status(500).json({
          success: false,
          error: 'Failed to generate CSV'
        });
      }
    } else {
      // Return JSON response - just the data array
      res.json(messages);
    }

  } catch (error) {
    logger.error(`Error getting messages for topic ${req.params[0]}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve messages'
    });
  }
});

// Helper function to generate CSV from messages
function generateCSV(messages, schema, useDedicatedTable) {
  console.log('Generating CSV with:', { messagesCount: messages.length, schema, useDedicatedTable });
  
  if (messages.length === 0) {
    console.log('No messages found, returning empty CSV');
    return '';
  }

  // Get field names from schema
  const fieldNames = Object.keys(schema);
  console.log('Field names:', fieldNames);
  
  // Create CSV header
  const headers = ['id', 'received_at', ...fieldNames];
  let csv = headers.join(',') + '\n';

  // Add data rows
  messages.forEach((message, index) => {
    console.log(`Processing message ${index}:`, message);
    const row = [];
    
    // Add id (from metadata)
    row.push(message._id || 'N/A');
    
    // Add received_at (from metadata)
    const receivedAt = message._received_at || new Date().toISOString();
    row.push(receivedAt);
    
    // Add message fields
    fieldNames.forEach(fieldName => {
      const value = message[fieldName];
      let csvValue = '';
      
      if (value !== null && value !== undefined) {
        if (typeof value === 'object') {
          // Handle objects and arrays
          csvValue = JSON.stringify(value);
        } else {
          // Handle primitive values
          csvValue = String(value);
        }
        
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (csvValue.includes(',') || csvValue.includes('"') || csvValue.includes('\n')) {
          csvValue = '"' + csvValue.replace(/"/g, '""') + '"';
        }
      }
      
      row.push(csvValue);
    });
    
    csv += row.join(',') + '\n';
  });

  console.log('Generated CSV preview:', csv.substring(0, 200) + '...');
  return csv;
}

// Publish message to a topic
router.post('/*/publish', async (req, res) => {
  try {
    const topicName = req.params[0]; // Use params[0] for wildcard routes
    const { error, value } = messageSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: `Validation error: ${error.details[0].message}`
      });
    }

    const { payload } = value;

    // Check if topic is configured
    if (!mqttService.isTopicSubscribed(topicName)) {
      return res.status(404).json({
        success: false,
        error: `Topic ${topicName} is not configured`
      });
    }

    // Publish message to MQTT topic
    await mqttService.publishMessage(topicName, payload);

    res.json({
      success: true,
      message: `Message published to topic ${topicName}`,
      data: { topic: topicName, payload }
    });

  } catch (error) {
    logger.error(`Error publishing message to topic ${req.params[0]}:`, error);
    
    if (error.message.includes('Payload validation failed')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to publish message'
    });
  }
});

// Get topic information (must come before the wildcard delete route)
router.get('/*', async (req, res) => {
  try {
    const topicName = req.params[0]; // Use params[0] for wildcard routes
    const topic = await database.getTopic(topicName);
    
    if (!topic) {
      return res.status(404).json({
        success: false,
        error: `Topic ${topicName} not found`
      });
    }

    const isSubscribed = mqttService.isTopicSubscribed(topicName);

    res.json({
      success: true,
      data: {
        name: topicName,
        schema: topic.schema,
        useDedicatedTable: topic.use_dedicated_table,
        isSubscribed,
        mqttConnected: mqttService.isConnected
      }
    });

  } catch (error) {
    logger.error(`Error getting topic info for ${req.params[0]}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve topic information'
    });
  }
});

// Delete a topic (must be last to avoid conflicts)
router.delete('/*', async (req, res) => {
  try {
    const topicName = req.params[0]; // Use params[0] for wildcard routes

    // Check if topic exists
    const schema = await database.getTopicSchema(topicName);
    if (!schema) {
      return res.status(404).json({
        success: false,
        error: `Topic ${topicName} not found`
      });
    }

    // Unsubscribe from MQTT topic
    if (mqttService.isTopicSubscribed(topicName)) {
      await mqttService.unsubscribeFromTopic(topicName);
    }

    // Delete topic from database
    await database.deleteTopic(topicName);

    logger.info(`Topic ${topicName} deleted successfully`);
    res.json({
      success: true,
      message: `Topic ${topicName} deleted successfully`
    });

  } catch (error) {
    logger.error(`Error deleting topic ${req.params[0]}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete topic'
    });
  }
});

module.exports = router; 
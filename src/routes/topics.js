const express = require('express');
const Joi = require('joi');
const logger = require('../config/logger');
const database = require('../config/database');
const mqttService = require('../services/mqttService');

const router = express.Router();

// Validation schemas
const topicSchema = Joi.object({
  name: Joi.string().required().min(1).max(255),
  schema: Joi.object().required()
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

    const { name, schema } = value;

    // Add topic to database
    await database.addTopic(name, schema);

    // Subscribe to MQTT topic
    await mqttService.subscribeToTopic(name, schema);

    logger.info(`Topic ${name} configured successfully`);
    res.status(201).json({
      success: true,
      message: `Topic ${name} configured successfully`,
      data: { name, schema }
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
router.get('/:topicName/messages', async (req, res) => {
  try {
    const { topicName } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    // Check if topic exists
    const schema = await database.getTopicSchema(topicName);
    if (!schema) {
      return res.status(404).json({
        success: false,
        error: `Topic ${topicName} not found`
      });
    }

    const messages = await database.getMessages(topicName, limit, offset);
    res.json({
      success: true,
      data: messages,
      count: messages.length,
      topic: topicName
    });

  } catch (error) {
    logger.error(`Error getting messages for topic ${req.params.topicName}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve messages'
    });
  }
});

// Publish message to a topic
router.post('/:topicName/publish', async (req, res) => {
  try {
    const { topicName } = req.params;
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
    logger.error(`Error publishing message to topic ${req.params.topicName}:`, error);
    
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

// Delete a topic
router.delete('/:topicName', async (req, res) => {
  try {
    const { topicName } = req.params;

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
    logger.error(`Error deleting topic ${req.params.topicName}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete topic'
    });
  }
});

// Get topic information
router.get('/:topicName', async (req, res) => {
  try {
    const { topicName } = req.params;
    const schema = await database.getTopicSchema(topicName);
    
    if (!schema) {
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
        schema,
        isSubscribed,
        mqttConnected: mqttService.isConnected
      }
    });

  } catch (error) {
    logger.error(`Error getting topic info for ${req.params.topicName}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve topic information'
    });
  }
});

module.exports = router; 
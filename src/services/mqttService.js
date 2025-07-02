const mqtt = require('mqtt');
const Joi = require('joi');
const logger = require('../config/logger');
const database = require('../config/database');

class MQTTService {
  constructor() {
    this.client = null;
    this.subscribedTopics = new Map();
    this.isConnected = false;
  }

  async connect(config) {
    const { host, port, username, password, clientId } = config;
    
    const options = {
      clientId: clientId || `comfy-mqtt-${Date.now()}`,
      clean: true,
      reconnectPeriod: 1000,
      connectTimeout: 30 * 1000,
      rejectUnauthorized: false
    };

    if (username) options.username = username;
    if (password) options.password = password;

    const url = `mqtt://${host}:${port}`;
    
    return new Promise((resolve, reject) => {
      this.client = mqtt.connect(url, options);

      this.client.on('connect', () => {
        this.isConnected = true;
        logger.info('Connected to MQTT broker');
        this.resubscribeTopics();
        resolve();
      });

      this.client.on('message', (topic, message) => {
        this.handleMessage(topic, message);
      });

      this.client.on('error', (error) => {
        logger.error('MQTT connection error:', error);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        logger.warn('MQTT connection closed');
        this.isConnected = false;
      });

      this.client.on('reconnect', () => {
        logger.info('Reconnecting to MQTT broker...');
      });

      this.client.on('offline', () => {
        logger.warn('MQTT client offline');
        this.isConnected = false;
      });
    });
  }

  async subscribeToTopic(topicName, schema) {
    if (!this.client || !this.isConnected) {
      throw new Error('MQTT client not connected');
    }

    return new Promise((resolve, reject) => {
      this.client.subscribe(topicName, (err) => {
        if (err) {
          logger.error(`Error subscribing to topic ${topicName}:`, err);
          reject(err);
        } else {
          this.subscribedTopics.set(topicName, schema);
          logger.info(`Subscribed to topic: ${topicName}`);
          resolve();
        }
      });
    });
  }

  async unsubscribeFromTopic(topicName) {
    if (!this.client || !this.isConnected) {
      throw new Error('MQTT client not connected');
    }

    return new Promise((resolve, reject) => {
      this.client.unsubscribe(topicName, (err) => {
        if (err) {
          logger.error(`Error unsubscribing from topic ${topicName}:`, err);
          reject(err);
        } else {
          this.subscribedTopics.delete(topicName);
          logger.info(`Unsubscribed from topic: ${topicName}`);
          resolve();
        }
      });
    });
  }

  async publishMessage(topicName, payload) {
    if (!this.client || !this.isConnected) {
      throw new Error('MQTT client not connected');
    }

    // Validate payload against schema if topic is configured
    const schema = this.subscribedTopics.get(topicName);
    if (schema) {
      try {
        const validationResult = Joi.object(schema).validate(payload);
        if (validationResult.error) {
          logger.warn(`Payload validation failed for topic ${topicName}:`, validationResult.error.details);
          throw new Error(`Payload validation failed: ${validationResult.error.details[0].message}`);
        }
      } catch (error) {
        if (error.message.includes('Payload validation failed')) {
          throw error;
        }
        logger.warn(`Schema validation error for topic ${topicName}:`, error);
      }
    }

    return new Promise((resolve, reject) => {
      const message = JSON.stringify(payload);
      this.client.publish(topicName, message, (err) => {
        if (err) {
          logger.error(`Error publishing to topic ${topicName}:`, err);
          reject(err);
        } else {
          logger.info(`Message published to topic: ${topicName}`);
          resolve();
        }
      });
    });
  }

  async handleMessage(topic, message) {
    try {
      const payload = JSON.parse(message.toString());
      const schema = this.subscribedTopics.get(topic);

      if (schema) {
        // Validate payload against schema
        const validationResult = Joi.object(schema).validate(payload);
        if (validationResult.error) {
          logger.warn(`Invalid payload received for topic ${topic}:`, validationResult.error.details);
          return;
        }
      }

      // Store message in database
      await database.storeMessage(topic, payload);
      logger.info(`Message received and stored for topic: ${topic}`);

    } catch (error) {
      logger.error(`Error handling message from topic ${topic}:`, error);
    }
  }

  async resubscribeTopics() {
    if (!this.client || !this.isConnected) {
      return;
    }

    for (const [topic, schema] of this.subscribedTopics) {
      try {
        await this.subscribeToTopic(topic, schema);
      } catch (error) {
        logger.error(`Error resubscribing to topic ${topic}:`, error);
      }
    }
  }

  getSubscribedTopics() {
    return Array.from(this.subscribedTopics.keys());
  }

  isTopicSubscribed(topicName) {
    return this.subscribedTopics.has(topicName);
  }

  disconnect() {
    if (this.client) {
      this.client.end();
      this.isConnected = false;
      logger.info('MQTT client disconnected');
    }
  }
}

module.exports = new MQTTService(); 
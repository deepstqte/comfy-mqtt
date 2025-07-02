const logger = require('./logger');

class InMemoryDatabase {
  constructor() {
    this.topics = new Map();
    this.messages = new Map();
    this.topicCounter = 0;
  }

  async initialize() {
    try {
      logger.info('In-memory database initialized successfully');
    } catch (error) {
      logger.error('Error initializing in-memory database:', error);
      throw error;
    }
  }

  async createTables() {
    // No-op for in-memory database
    logger.info('In-memory database tables ready');
  }

  async createTopicTable(topicName) {
    // Initialize message storage for this topic
    if (!this.messages.has(topicName)) {
      this.messages.set(topicName, []);
    }
    logger.info(`Message storage ready for topic ${topicName}`);
    return topicName;
  }

  async addTopic(topicName, schema) {
    try {
      this.topicCounter++;
      this.topics.set(topicName, {
        id: this.topicCounter,
        name: topicName,
        schema: schema,
        created_at: new Date().toISOString()
      });
      
      await this.createTopicTable(topicName);
      logger.info(`Topic ${topicName} added successfully`);
    } catch (error) {
      logger.error('Error adding topic:', error);
      throw error;
    }
  }

  async getTopics() {
    try {
      return Array.from(this.topics.values()).sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      );
    } catch (error) {
      logger.error('Error getting topics:', error);
      throw error;
    }
  }

  async getTopicSchema(topicName) {
    try {
      const topic = this.topics.get(topicName);
      return topic ? topic.schema : null;
    } catch (error) {
      logger.error('Error getting topic schema:', error);
      throw error;
    }
  }

  async storeMessage(topicName, payload) {
    try {
      if (!this.messages.has(topicName)) {
        this.messages.set(topicName, []);
      }
      
      const messageId = Date.now() + Math.random();
      const message = {
        id: messageId,
        payload: payload,
        received_at: new Date().toISOString()
      };
      
      this.messages.get(topicName).unshift(message); // Add to beginning for newest first
      
      logger.info(`Message stored for topic ${topicName} with ID ${messageId}`);
      return messageId;
    } catch (error) {
      logger.error(`Error storing message for topic ${topicName}:`, error);
      throw error;
    }
  }

  async getMessages(topicName, limit = 100, offset = 0) {
    try {
      const messages = this.messages.get(topicName) || [];
      return messages.slice(offset, offset + limit);
    } catch (error) {
      logger.error(`Error getting messages for topic ${topicName}:`, error);
      throw error;
    }
  }

  async deleteTopic(topicName) {
    try {
      // Delete topic
      this.topics.delete(topicName);
      
      // Delete messages
      this.messages.delete(topicName);
      
      logger.info(`Topic ${topicName} and its messages deleted successfully`);
    } catch (error) {
      logger.error('Error deleting topic:', error);
      throw error;
    }
  }

  close() {
    try {
      // Clear in-memory data
      this.topics.clear();
      this.messages.clear();
      logger.info('In-memory database cleared');
    } catch (error) {
      logger.error('Error closing in-memory database:', error);
    }
  }
}

module.exports = new InMemoryDatabase(); 
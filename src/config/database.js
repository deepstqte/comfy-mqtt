const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

class PostgreSQLDatabase {
  constructor() {
    this.pool = null;
  }

  async initialize() {
    try {
      this.pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME || 'comfy_mqtt',
        user: process.env.DB_USER || 'comfy_mqtt',
        password: process.env.DB_PASSWORD || 'comfy_mqtt_password',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Test the connection
      const client = await this.pool.connect();
      client.release();
      
      await this.createTables();
      logger.info('PostgreSQL database initialized successfully');
    } catch (error) {
      logger.error('Error initializing PostgreSQL database:', error);
      throw error;
    }
  }

  async createTables() {
    const client = await this.pool.connect();
    try {
      // Read and execute the schema SQL file
      const schemaPath = path.join(__dirname, '../../database/schema.sql');
      const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
      
      // Execute the schema SQL
      await client.query(schemaSQL);
      
      logger.info('PostgreSQL database schema applied successfully');
    } catch (error) {
      logger.error('Error applying database schema:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async addTopic(topicName, schema) {
    const client = await this.pool.connect();
    try {
      await client.query(
        'INSERT INTO topics (name, schema) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET schema = $2',
        [topicName, JSON.stringify(schema)]
      );
      
      logger.info(`Topic ${topicName} added successfully`);
    } finally {
      client.release();
    }
  }

  async getTopics() {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM topics ORDER BY created_at DESC'
      );
      
      return result.rows.map(row => ({
        ...row,
        schema: row.schema
      }));
    } finally {
      client.release();
    }
  }

  async getTopicSchema(topicName) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT schema FROM topics WHERE name = $1',
        [topicName]
      );
      
      return result.rows.length > 0 ? result.rows[0].schema : null;
    } finally {
      client.release();
    }
  }

  async storeMessage(topicName, payload) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'INSERT INTO messages (topic_name, payload) VALUES ($1, $2) RETURNING id',
        [topicName, JSON.stringify(payload)]
      );
      
      logger.info(`Message stored for topic ${topicName} with ID ${result.rows[0].id}`);
      return result.rows[0].id;
    } finally {
      client.release();
    }
  }

  async getMessages(topicName, limit = 100, offset = 0) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT payload FROM messages WHERE topic_name = $1 ORDER BY received_at DESC LIMIT $2 OFFSET $3',
        [topicName, limit, offset]
      );
      
      return result.rows.map(row => row.payload);
    } finally {
      client.release();
    }
  }

  async deleteTopic(topicName) {
    const client = await this.pool.connect();
    try {
      // Delete topic (messages will be deleted automatically due to CASCADE)
      await client.query('DELETE FROM topics WHERE name = $1', [topicName]);
      
      logger.info(`Topic ${topicName} and its messages deleted successfully`);
    } finally {
      client.release();
    }
  }

  close() {
    if (this.pool) {
      this.pool.end();
      logger.info('PostgreSQL database connection closed');
    }
  }
}

module.exports = new PostgreSQLDatabase(); 
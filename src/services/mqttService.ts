import mqtt from 'mqtt';
import Joi from 'joi';
import { logger } from '../config/logger';
import { MqttService, MqttConfig, MqttMessage } from '../types';
import database from '../config/database.js';

class MqttServiceImpl implements MqttService {
  private client: ReturnType<typeof mqtt.connect> | null = null;
  private subscribedTopics: Map<string, Joi.ObjectSchema> = new Map();
  public isConnected: boolean = false;

  async connect(): Promise<void> {
    try {
      const config: MqttConfig = {
        host: process.env.MQTT_HOST || 'localhost',
        port: parseInt(process.env.MQTT_PORT || '1883'),
        username: process.env.MQTT_USERNAME,
        password: process.env.MQTT_PASSWORD,
        clientId: process.env.MQTT_CLIENT_ID || `comfy-mqtt-${Date.now()}`
      };

      const url = `mqtt://${config.host}:${config.port}`;
      const options: mqtt.IClientOptions = {
        clientId: config.clientId,
        clean: true,
        reconnectPeriod: 1000,
        connectTimeout: 30000,
      };

      if (config.username) {
        options.username = config.username;
      }
      if (config.password) {
        options.password = config.password;
      }

      this.client = mqtt.connect(url, options);

      this.client.on('connect', () => {
        this.isConnected = true;
        logger.info('Connected to MQTT broker');
        
        // Resubscribe to topics after reconnection
        for (const [topic, schema] of this.subscribedTopics) {
          this.client?.subscribe(topic, (err) => {
            if (err) {
              logger.error(`Error resubscribing to ${topic}:`, err);
            } else {
              logger.info(`Resubscribed to topic: ${topic}`);
            }
          });
        }
      });

      this.client.on('message', (topic: string, message: Buffer) => {
        this.handleMessage(topic, message);
      });

      this.client.on('error', (error) => {
        logger.error('MQTT error:', error);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        logger.info('MQTT connection closed');
        this.isConnected = false;
      });

      this.client.on('reconnect', () => {
        logger.info('MQTT reconnecting...');
      });

    } catch (error) {
      logger.error('Error connecting to MQTT broker:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.end();
      this.client = null;
      this.isConnected = false;
      logger.info('Disconnected from MQTT broker');
    }
  }

  async subscribeToTopic(topicName: string, schema: Record<string, any>): Promise<void> {
    if (!this.client) {
      throw new Error('MQTT client not connected');
    }

    try {
      // Convert string-based schema to Joi schema
      const joiSchema = this.convertSchemaToJoi(schema);
      
      // Subscribe to topic
      this.client.subscribe(topicName, (err) => {
        if (err) {
          logger.error(`Error subscribing to topic ${topicName}:`, err);
          throw err;
        } else {
          logger.info(`Subscribed to topic: ${topicName}`);
          this.subscribedTopics.set(topicName, joiSchema);
        }
      });
    } catch (error) {
      logger.error(`Error subscribing to topic ${topicName}:`, error);
      throw error;
    }
  }

  async unsubscribeFromTopic(topicName: string): Promise<void> {
    if (!this.client) {
      throw new Error('MQTT client not connected');
    }

    try {
      this.client.unsubscribe(topicName, (err) => {
        if (err) {
          logger.error(`Error unsubscribing from topic ${topicName}:`, err);
          throw err;
        } else {
          logger.info(`Unsubscribed from topic: ${topicName}`);
          this.subscribedTopics.delete(topicName);
        }
      });
    } catch (error) {
      logger.error(`Error unsubscribing from topic ${topicName}:`, error);
      throw error;
    }
  }

  async publishMessage(topicName: string, payload: Record<string, any>): Promise<void> {
    if (!this.client) {
      throw new Error('MQTT client not connected');
    }

    try {
      // Validate payload against schema if topic is subscribed
      const schema = this.subscribedTopics.get(topicName);
      if (schema) {
        const { error } = schema.validate(payload);
        if (error) {
          throw new Error(`Payload validation failed: ${error.details[0].message}`);
        }
      }

      // Publish message
      this.client.publish(topicName, JSON.stringify(payload), (err) => {
        if (err) {
          logger.error(`Error publishing message to topic ${topicName}:`, err);
          throw err;
        } else {
          logger.info(`Message published to topic: ${topicName}`);
        }
      });
    } catch (error) {
      logger.error(`Error publishing message to topic ${topicName}:`, error);
      throw error;
    }
  }

  isTopicSubscribed(topicName: string): boolean {
    return this.subscribedTopics.has(topicName);
  }

  private handleMessage(topic: string, message: Buffer): void {
    try {
      const payload = JSON.parse(message.toString());
      logger.info(`Received message on topic ${topic}:`, payload);

      // Validate payload against schema
      const schema = this.subscribedTopics.get(topic);
      if (schema) {
        const { error } = schema.validate(payload);
        if (error) {
          logger.error(`Invalid payload received on topic ${topic}:`, error.details[0].message);
          logger.error(error.details[0].message);
          return;
        }
      }

      // Store message in database
      this.storeMessageInDatabase(topic, payload);
    } catch (error) {
      logger.error(`Error handling message from topic ${topic}:`, error);
    }
  }

  private async storeMessageInDatabase(topic: string, payload: Record<string, any>): Promise<void> {
    try {
      await database.storeMessage(topic, payload);
    } catch (error) {
      logger.error(`Error storing message in database for topic ${topic}:`, error);
    }
  }

  private convertSchemaToJoi(schema: Record<string, any>): Joi.ObjectSchema {
    const joiSchema: Record<string, any> = {};

    for (const [fieldName, fieldType] of Object.entries(schema)) {
      if (typeof fieldType === 'string') {
        switch (fieldType.toLowerCase()) {
          case 'string':
            joiSchema[fieldName] = Joi.string().allow('');
            break;
          case 'number':
          case 'integer':
            joiSchema[fieldName] = Joi.number();
            break;
          case 'boolean':
            joiSchema[fieldName] = Joi.boolean();
            break;
          case 'date':
          case 'timestamp':
            joiSchema[fieldName] = Joi.date();
            break;
          case 'array':
            joiSchema[fieldName] = Joi.array();
            break;
          case 'object':
            joiSchema[fieldName] = Joi.object();
            break;
          default:
            joiSchema[fieldName] = Joi.any();
        }
      } else if (typeof fieldType === 'object') {
        // Handle nested objects
        joiSchema[fieldName] = Joi.object();
      } else {
        joiSchema[fieldName] = Joi.any();
      }
    }

    return Joi.object(joiSchema);
  }

  public get subscribedTopicNames(): string[] {
    return Array.from(this.subscribedTopics.keys());
  }
}

export default new MqttServiceImpl(); 
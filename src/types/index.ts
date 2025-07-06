import { Request, Response } from 'express';
import { Pool, PoolClient } from 'pg';

// Database types
export interface Topic {
  id: number;
  name: string;
  schema: Record<string, any>;
  use_dedicated_table: boolean;
  created_at: Date;
}

export interface Message {
  id: number;
  topic_name: string;
  payload: Record<string, any>;
  received_at: Date;
}

export interface MessageWithMetadata extends Record<string, any> {
  _id?: number;
  _received_at?: Date;
}

// API types
export interface TopicSchema {
  name: string;
  schema: Record<string, any>;
  useDedicatedTable?: boolean;
}

export interface MessagePayload {
  payload: Record<string, any>;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  count?: number;
  topic?: string;
}

// MQTT types
export interface MqttConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  clientId: string;
}

export interface MqttMessage {
  topic: string;
  payload: Buffer;
  qos: number;
  retain: boolean;
}

// Database types
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

// Request types
export interface GetMessagesQuery {
  limit?: string;
  offset?: string;
  format?: 'json' | 'csv';
  order?: 'asc' | 'desc';
}

export interface CreateTopicRequest {
  name: string;
  schema: Record<string, any>;
  useDedicatedTable?: boolean;
}

export interface PublishMessageRequest {
  payload: Record<string, any>;
}

// Service types
export interface MqttService {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribeToTopic(topicName: string, schema: Record<string, any>): Promise<void>;
  unsubscribeFromTopic(topicName: string): Promise<void>;
  publishMessage(topicName: string, payload: Record<string, any>): Promise<void>;
  isTopicSubscribed(topicName: string): boolean;
  isConnected: boolean;
  subscribedTopicNames: string[];
}

export interface DatabaseService {
  initialize(): Promise<void>;
  addTopic(topicName: string, schema: Record<string, any>, useDedicatedTable?: boolean): Promise<void>;
  getTopics(): Promise<Topic[]>;
  getTopic(topicName: string): Promise<Topic | null>;
  getTopicSchema(topicName: string): Promise<Record<string, any> | null>;
  storeMessage(topicName: string, payload: Record<string, any>): Promise<number>;
  getMessages(topicName: string, limit?: number | null, offset?: number, includeMetadata?: boolean, order?: 'asc' | 'desc'): Promise<MessageWithMetadata[]>;
  deleteTopic(topicName: string): Promise<void>;
  close(): void;
} 
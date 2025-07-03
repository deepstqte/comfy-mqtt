-- Comfy MQTT Database Schema
-- This file contains the complete database schema for the comfy-mqtt application

-- Topics table - stores MQTT topic configurations and schemas
CREATE TABLE IF NOT EXISTS topics (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  schema JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Messages table - stores MQTT messages with topic reference
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  topic_name VARCHAR(255) NOT NULL,
  payload JSONB NOT NULL,
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (topic_name) REFERENCES topics(name) ON DELETE CASCADE
);

-- Index for better performance on message queries
CREATE INDEX IF NOT EXISTS idx_messages_topic_received 
ON messages(topic_name, received_at DESC);

-- Index for topic name lookups
CREATE INDEX IF NOT EXISTS idx_topics_name 
ON topics(name);

-- Add comments for documentation
COMMENT ON TABLE topics IS 'Stores MQTT topic configurations and their validation schemas';
COMMENT ON TABLE messages IS 'Stores MQTT messages received for each topic';
COMMENT ON COLUMN topics.schema IS 'JSONB object containing Joi validation schema for the topic';
COMMENT ON COLUMN messages.payload IS 'JSONB object containing the actual message payload'; 
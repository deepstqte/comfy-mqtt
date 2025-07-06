-- Comfy MQTT Database Schema
-- This file contains the complete database schema for the comfy-mqtt application

-- Topics table - stores MQTT topic configurations and schemas
CREATE TABLE IF NOT EXISTS topics (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  schema JSONB NOT NULL,
  use_dedicated_table BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Generic messages table for topics that don't use dedicated tables
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  topic_name VARCHAR(255) NOT NULL,
  payload JSONB NOT NULL,
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (topic_name) REFERENCES topics(name) ON DELETE CASCADE
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_topics_name 
ON topics(name);

CREATE INDEX IF NOT EXISTS idx_messages_topic_received 
ON messages(topic_name, received_at ASC);

-- Add comments for documentation
COMMENT ON TABLE topics IS 'Stores MQTT topic configurations and their validation schemas';
COMMENT ON COLUMN topics.schema IS 'JSONB object containing Joi validation schema for the topic';
COMMENT ON COLUMN topics.use_dedicated_table IS 'Whether this topic uses a dedicated table or the generic messages table';
COMMENT ON TABLE messages IS 'Stores MQTT messages for topics that use the generic table';
COMMENT ON COLUMN messages.payload IS 'JSONB object containing the actual message payload';

-- Note: Individual topic tables will be created dynamically when topics are added with use_dedicated_table=true
-- Each topic table will follow the naming convention: topic_<sanitized_topic_name>
-- Example: topic_sensor_temperature, topic_home_living_room_thermostat 
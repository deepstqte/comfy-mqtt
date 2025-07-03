-- Comfy MQTT Database Initialization Script
-- Run this script to initialize the database manually

-- Create database if it doesn't exist (run this as superuser)
-- CREATE DATABASE comfy_mqtt;

-- Connect to the database
-- \c comfy_mqtt;

-- Create the application user if it doesn't exist (run this as superuser)
-- CREATE USER comfy_mqtt WITH PASSWORD 'comfy_mqtt_password';

-- Grant privileges to the application user
GRANT ALL PRIVILEGES ON DATABASE comfy_mqtt TO comfy_mqtt;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO comfy_mqtt;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO comfy_mqtt;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO comfy_mqtt;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO comfy_mqtt;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO comfy_mqtt;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO comfy_mqtt;

-- Apply the schema
\i schema.sql

-- Verify the tables were created
\dt

-- Show table structure
\d topics
\d messages 
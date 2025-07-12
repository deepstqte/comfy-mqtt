# Comfy MQTT

A REST API layer on top of MQTT with database storage and payload validation. This service allows you to configure MQTT topics with specific payload schemas, automatically stores received messages, and provides REST endpoints to retrieve and publish messages.

## Installation

### Global Installation (Recommended)

Install the package globally to use it as a CLI tool:

```bash
npm install -g comfy-mqtt
```

After installation, you can start the server from any directory:

```bash
comfy-mqtt
```

The first time you run the command, it will prompt you to configure your MQTT broker and PostgreSQL database settings, then create a `.env` file for future use.

### Local Installation

For development or local use:

```bash
npm install comfy-mqtt
```

Then run:

```bash
npm start
```

## Features

- **MQTT Integration**: Subscribe to multiple MQTT topics and handle incoming messages
- **Database Storage**: Automatically store received messages in PostgreSQL database with topic-specific tables
- **Payload Validation**: Validate incoming and outgoing messages against Joi schemas
- **REST API**: Full REST API for topic management and message handling
- **Health Monitoring**: Built-in health check endpoints
- **Logging**: Comprehensive logging with Winston
- **Graceful Shutdown**: Proper cleanup on server shutdown
- **Interactive Setup**: Automatic configuration wizard for first-time setup

## First-Time Setup

When you run `comfy-mqtt` for the first time, you'll be prompted to configure:

### Server Configuration
- **Port**: HTTP server port (default: 3000)
- **Environment**: Development or production mode
- **Log Level**: Error, warn, info, or debug

### MQTT Broker Configuration
- **Host**: MQTT broker hostname or IP
- **Port**: MQTT broker port (default: 1883)
- **Username**: MQTT username (optional)
- **Password**: MQTT password (optional)
- **Client ID**: MQTT client identifier

### PostgreSQL Database Configuration
- **Host**: PostgreSQL server hostname or IP
- **Port**: PostgreSQL port (default: 5432)
- **Database Name**: Database name for storing messages
- **Username**: PostgreSQL username
- **Password**: PostgreSQL password

After configuration, a `.env` file will be created in the current directory with your settings.

## Prerequisites

- Node.js (v14 or higher)
- MQTT Broker (e.g., Mosquitto, HiveMQ, AWS IoT)
- PostgreSQL database

## Usage

### Start the server:
```bash
comfy-mqtt
```

### Development mode with auto-restart:
```bash
npm run dev
```

The server will start on port 3000 (or the port specified in your `.env` file).

## API Documentation

### Base URL
```
http://localhost:3000/api
```

### Topics Management

#### Get all configured topics
```http
GET /api/topics
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "sensor/temperature",
      "schema": {
        "temperature": "number",
        "humidity": "number",
        "timestamp": "string"
      },
      "created_at": "2024-01-01T12:00:00.000Z"
    }
  ],
  "count": 1
}
```

#### Configure a new topic
```http
POST /api/topics
Content-Type: application/json

{
  "name": "sensor/temperature",
  "schema": {
    "temperature": "number",
    "humidity": "number",
    "timestamp": "string"
  },
  "useDedicatedTable": false
}
```

**Parameters:**
- `name` (required): MQTT topic name
- `schema` (required): Joi validation schema for the topic
- `useDedicatedTable` (optional): Whether to create a dedicated table for this topic (default: false)

Response:
```json
{
  "success": true,
  "message": "Topic sensor/temperature configured successfully",
  "data": {
    "name": "sensor/temperature",
    "schema": {
      "temperature": "number",
      "humidity": "number",
      "timestamp": "string"
    },
    "useDedicatedTable": false
  }
}
```

#### Get messages for a topic
```http
GET /api/topics/sensor/temperature/messages?limit=10&offset=0
```

Response:
```json
[
  {
    "temperature": 25.5,
    "humidity": 60.2,
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
]
```

**Note:** Messages are returned in chronological order by default (oldest first). Use `order=desc` to get newest first.

#### Download messages as CSV
```http
GET /api/topics/sensor/temperature/messages?format=csv&limit=100
```

**Ordering Examples:**
```http
# All records, oldest first (default)
GET /api/topics/sensor/temperature/messages

# All records, newest first
GET /api/topics/sensor/temperature/messages?order=desc

# First 50 records, oldest first
GET /api/topics/sensor/temperature/messages?limit=50

# First 50 records, newest first
GET /api/topics/sensor/temperature/messages?limit=50&order=desc

# CSV with all records, newest first
GET /api/topics/sensor/temperature/messages?format=csv&order=desc
```

This will download a CSV file with the following columns:
- `id`: Database record ID
- `received_at`: Timestamp when message was received
- Schema fields: Individual columns for each field in the topic schema

**Query Parameters:**
- `format`: `json` (default) or `csv`
- `limit`: Number of records to retrieve (optional - if not specified, returns all records)
- `offset`: Number of records to skip (default: 0)
- `order`: `asc` (default) or `desc` - chronological ordering

**Example CSV Output:**
```csv
id,received_at,temperature,humidity,timestamp
1,2024-01-01T12:00:00.000Z,25.5,60.2,2024-01-01T12:00:00.000Z
2,2024-01-01T12:05:00.000Z,26.0,58.5,2024-01-01T12:05:00.000Z
```

**Note:** CSV data is ordered chronologically by default (oldest first). Use `order=desc` to get newest first.

#### Publish message to a topic
```http
POST /api/topics/sensor/temperature/publish
Content-Type: application/json

{
  "payload": {
    "temperature": 26.0,
    "humidity": 58.5,
    "timestamp": "2024-01-01T12:05:00.000Z"
  }
}
```

Response:
```json
{
  "success": true,
  "message": "Message published to topic sensor/temperature",
  "data": {
    "topic": "sensor/temperature",
    "payload": {
      "temperature": 26.0,
      "humidity": 58.5,
      "timestamp": "2024-01-01T12:05:00.000Z"
    }
  }
}
```

#### Get topic information
```http
GET /api/topics/sensor/temperature
```

Response:
```json
{
  "success": true,
  "data": {
    "name": "sensor/temperature",
    "schema": {
      "temperature": "number",
      "humidity": "number",
      "timestamp": "string"
    },
    "useDedicatedTable": false,
    "isSubscribed": true,
    "mqttConnected": true
  }
}
```

#### Delete a topic
```http
DELETE /api/topics/sensor/temperature
```

Response:
```json
{
  "success": true,
  "message": "Topic sensor/temperature deleted successfully"
}
```

### Health Monitoring

#### Health check
```http
GET /api/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "services": {
    "mqtt": {
      "connected": true,
      "subscribedTopics": 2
    },
    "database": {
      "connected": true
    }
  }
}
```

#### Detailed status
```http
GET /api/health/status
```

Response:
```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "mqtt": {
    "connected": true,
    "subscribedTopics": ["sensor/temperature", "sensor/humidity"],
    "clientId": "comfy-mqtt-1704110400000"
  },
  "database": {
    "connected": true,
    "path": "/path/to/data/comfy-mqtt.db"
  }
}
```

## Schema Validation

The service uses Joi for payload validation. When you configure a topic, you specify a schema that defines the expected structure of the payload. Here are some example schemas:

### Simple sensor data
```json
{
  "temperature": "number",
  "humidity": "number",
  "timestamp": "string"
}
```

### Complex IoT device data
```json
{
  "deviceId": "string",
  "location": {
    "lat": "number",
    "lng": "number"
  },
  "readings": {
    "temperature": "number",
    "pressure": "number",
    "altitude": "number"
  },
  "metadata": {
    "battery": "number",
    "signal": "number"
  },
  "timestamp": "string"
}
```

### Array of measurements
```json
{
  "deviceId": "string",
  "measurements": "array",
  "timestamp": "string"
}
```

## Database Structure

The service uses PostgreSQL with a configurable table architecture that supports both shared and dedicated tables.

### Tables

- `topics` table: Stores topic configurations and schemas
- `messages` table: Shared table for topics that don't use dedicated tables
- Individual topic tables: Optional dedicated tables for specific topics

### Architecture

The system supports two table strategies:

#### 1. Shared Table (Default)
- All messages stored in the `messages` table
- Good for topics with low message volume
- Simpler database structure
- Use by setting `useDedicatedTable: false` (or omitting the parameter)

#### 2. Dedicated Tables
- Each topic gets its own table with individual columns for each schema field
- Table naming convention: `topic_<sanitized_topic_name>`
- Example: Topic `sensor/temperature` with schema `{"temperature": "number", "humidity": "number"}` → Table `topic_sensor_temperature` with columns `temperature NUMERIC, humidity NUMERIC`
- Better for high-volume topics, complex queries, or when you need structured data storage

### Benefits

**Shared Tables:**
- Simpler database structure
- Easier to manage
- Good for low-volume topics

**Dedicated Tables:**
- Better isolation: Each topic's data is completely separate
- Improved performance: No need to filter by topic_name
- Structured storage: Individual columns for each schema field
- Better query performance: Can index and query specific fields
- Automatic cleanup: When a topic is deleted, its entire table is dropped

### Schema

```sql
-- Topics table
CREATE TABLE topics (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  schema JSONB NOT NULL,
  use_dedicated_table BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Generic messages table for shared topics
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  topic_name VARCHAR(255) NOT NULL,
  payload JSONB NOT NULL,
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (topic_name) REFERENCES topics(name) ON DELETE CASCADE
);

-- Individual topic tables (created dynamically when use_dedicated_table=true)
-- Columns are created based on the schema definition
CREATE TABLE topic_<sanitized_name> (
  id SERIAL PRIMARY KEY,
  -- Individual columns for each schema field
  -- Example: temperature NUMERIC, humidity NUMERIC, timestamp TEXT
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

The complete schema is defined in `database/schema.sql` and is automatically applied when the application starts. Topic tables are created automatically when topics are configured with `useDedicatedTable: true`.

### Type Mapping for Dedicated Tables

When creating dedicated tables, schema field types are mapped to PostgreSQL types:

| Joi Type | PostgreSQL Type | Description |
|----------|----------------|-------------|
| `"number"` | `NUMERIC` | Numeric values |
| `"integer"` | `NUMERIC` | Integer values |
| `"boolean"` | `BOOLEAN` | Boolean values |
| `"string"` | `TEXT` | Text values |
| `"date"` | `TIMESTAMP` | Date/time values |
| `"timestamp"` | `TIMESTAMP` | Date/time values |
| `"array"` | `JSONB` | Array values |
| `"object"` | `JSONB` | Object values |

**Example:** Schema `{"temperature": "number", "location": "object", "active": "boolean"}` creates columns:
- `temperature NUMERIC`
- `location JSONB`
- `active BOOLEAN`

## Logging

Logs are stored in the `logs/` directory:
- `combined.log`: All log levels
- `error.log`: Error level logs only

In development mode, logs are also output to the console.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | 3000 |
| `NODE_ENV` | Environment mode | development |
| `LOG_LEVEL` | Logging level | info |
| `MQTT_HOST` | MQTT broker host | localhost |
| `MQTT_PORT` | MQTT broker port | 1883 |
| `MQTT_USERNAME` | MQTT username | - |
| `MQTT_PASSWORD` | MQTT password | - |
| `MQTT_CLIENT_ID` | MQTT client ID | comfy-mqtt-{timestamp} |
| `DB_HOST` | PostgreSQL host | localhost |
| `DB_PORT` | PostgreSQL port | 5432 |
| `DB_NAME` | PostgreSQL database name | comfy_mqtt |
| `DB_USER` | PostgreSQL username | comfy_mqtt |
| `DB_PASSWORD` | PostgreSQL password | - |

## Error Handling

The service provides comprehensive error handling:

- **Validation Errors**: Returns 400 with detailed validation messages
- **Not Found**: Returns 404 for non-existent topics
- **MQTT Errors**: Logs errors and returns appropriate HTTP status codes
- **Database Errors**: Handles database connection and query errors
- **Unhandled Errors**: Returns 500 with generic error message

## Security Features

- **Helmet**: Security headers
- **CORS**: Configurable cross-origin requests
- **Input Validation**: All inputs validated with Joi
- **SQL Injection Protection**: Parameterized queries
- **Request Logging**: All requests logged with IP and user agent

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License 
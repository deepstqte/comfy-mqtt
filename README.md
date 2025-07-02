# Comfy MQTT

A REST API layer on top of MQTT with database storage and payload validation. This service allows you to configure MQTT topics with specific payload schemas, automatically stores received messages, and provides REST endpoints to retrieve and publish messages.

## Features

- **MQTT Integration**: Subscribe to multiple MQTT topics and handle incoming messages
- **Database Storage**: Automatically store received messages in SQLite database with topic-specific tables
- **Payload Validation**: Validate incoming and outgoing messages against Joi schemas
- **REST API**: Full REST API for topic management and message handling
- **Health Monitoring**: Built-in health check endpoints
- **Logging**: Comprehensive logging with Winston
- **Graceful Shutdown**: Proper cleanup on server shutdown

## Prerequisites

- Node.js (v14 or higher)
- MQTT Broker (e.g., Mosquitto, HiveMQ, AWS IoT)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd comfy-mqtt
```

2. Install dependencies:
```bash
npm install
```

3. Copy the environment file and configure it:
```bash
cp env.example .env
```

4. Edit `.env` file with your MQTT broker configuration:
```env
MQTT_HOST=your-mqtt-broker-host
MQTT_PORT=1883
MQTT_USERNAME=your-username
MQTT_PASSWORD=your-password
```

## Usage

### Start the server:
```bash
npm start
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
  }
}
```

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
    }
  }
}
```

#### Get messages for a topic
```http
GET /api/topics/sensor/temperature/messages?limit=10&offset=0
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "payload": {
        "temperature": 25.5,
        "humidity": 60.2,
        "timestamp": "2024-01-01T12:00:00.000Z"
      },
      "received_at": "2024-01-01T12:00:00.000Z"
    }
  ],
  "count": 1,
  "topic": "sensor/temperature"
}
```

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

The service uses SQLite with the following structure:

- `topics` table: Stores topic configurations and schemas
- `topic_<topic_name>` tables: One table per topic for storing messages

Each topic table has the following structure:
```sql
CREATE TABLE topic_<topic_name> (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payload TEXT NOT NULL,
  received_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

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
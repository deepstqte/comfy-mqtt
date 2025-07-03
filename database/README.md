# Database Schema and Setup

This directory contains the database schema and initialization scripts for the Comfy MQTT application.

## Files

- `schema.sql` - Main database schema with tables, indexes, and comments
- `init.sql` - Manual initialization script for setting up the database
- `README.md` - This documentation file

## Database Schema

### Tables

#### `topics`
Stores MQTT topic configurations and their validation schemas.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `name` | VARCHAR(255) | Unique topic name |
| `schema` | JSONB | Joi validation schema for the topic |
| `created_at` | TIMESTAMP | When the topic was created |

#### `messages`
Stores MQTT messages received for each topic.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `topic_name` | VARCHAR(255) | Foreign key to topics.name |
| `payload` | JSONB | The actual message payload |
| `received_at` | TIMESTAMP | When the message was received |

### Indexes

- `idx_messages_topic_received` - Optimizes queries for messages by topic and timestamp
- `idx_topics_name` - Optimizes topic name lookups

### Foreign Keys

- `messages.topic_name` → `topics.name` (CASCADE DELETE)

## Automatic Setup

The database schema is automatically applied when the application starts. The application will:

1. Connect to PostgreSQL
2. Read and execute `schema.sql`
3. Create tables and indexes if they don't exist
4. Log the success/failure of the operation

## Manual Setup

If you need to set up the database manually:

1. Connect to PostgreSQL as a superuser
2. Run the commands in `init.sql`
3. Or execute `schema.sql` directly

```bash
# Connect to PostgreSQL
psql -U postgres

# Run the initialization script
\i database/init.sql
```

## Environment Variables

Make sure these environment variables are set:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=comfy_mqtt
DB_USER=comfy_mqtt
DB_PASSWORD=your_password
```

## Docker Setup

When using Docker Compose, the database is automatically created with:

- Database name: `comfy_mqtt`
- Username: `comfy_mqtt`
- Password: Set via `DB_PASSWORD` environment variable
- Data persistence: `postgres_data` volume 
# Database Schema and Setup

This directory contains the database schema and initialization scripts for the Comfy MQTT application.

## Files

- `schema.sql` - Main database schema with tables, indexes, and comments
- `init.sql` - Manual initialization script for setting up the database
- `README.md` - This documentation file

## Database Schema

The application uses a configurable table architecture that supports both shared and dedicated tables.

### Tables

#### `topics`
Stores MQTT topic configurations and their validation schemas.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `name` | VARCHAR(255) | Unique topic name |
| `schema` | JSONB | Joi validation schema for the topic |
| `use_dedicated_table` | BOOLEAN | Whether this topic uses a dedicated table |
| `created_at` | TIMESTAMP | When the topic was created |

#### `messages`
Shared table for topics that don't use dedicated tables.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `topic_name` | VARCHAR(255) | Foreign key to topics.name |
| `payload` | JSONB | The actual message payload |
| `received_at` | TIMESTAMP | When the message was received |

#### Individual Topic Tables
Optional dedicated tables for specific topics with schema-based columns.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `{field_name}` | Various | Individual columns for each schema field |
| `received_at` | TIMESTAMP | When the message was received |

**Example:** For schema `{"temperature": "number", "humidity": "number"}`:
- `temperature` column (NUMERIC)
- `humidity` column (NUMERIC)

### Table Naming Convention

Dedicated topic tables follow the naming pattern: `topic_<sanitized_topic_name>`

Examples:
- Topic `sensor/temperature` → Table `topic_sensor_temperature`
- Topic `home/living-room/thermostat` → Table `topic_home_living_room_thermostat`

### Architecture Benefits

**Shared Tables (Default):**
- Simpler database structure
- Easier to manage
- Good for low-volume topics

**Dedicated Tables:**
- Better isolation: Each topic's data is completely separate
- Improved performance: No need to filter by topic_name
- Structured storage: Individual columns for each schema field
- Better query performance: Can index and query specific fields
- Automatic cleanup: When a topic is deleted, its entire table is dropped
- Scalability: Each topic can scale independently

### Indexes

- `idx_topics_name` - Optimizes topic name lookups
- `idx_messages_topic_received` - Optimizes queries for shared messages (chronological order)
- Individual topic tables get their own indexes for `received_at ASC` (chronological order)

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
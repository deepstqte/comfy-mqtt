import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { logger } from './logger';
import { Topic, MessageWithMetadata, DatabaseService } from '../types';

// Helper function to get sanitized table name for a topic
function getTopicTableName(topicName: string): string {
  const sanitizedTopicName = topicName.replace(/[^a-zA-Z0-9]/g, '_');
  return `topic_${sanitizedTopicName}`;
}

class PostgreSQLDatabase implements DatabaseService {
  private pool: Pool | null = null;
  private maxTableSizeKB: number;

  constructor() {
    // Get max table size from environment (default to 100MB if not specified)
    this.maxTableSizeKB = parseInt(process.env['MAX_DB_TABLE_SIZE'] || '102400');
  }

  async initialize(): Promise<void> {
    try {
      this.pool = new Pool({
        host: process.env['DB_HOST'] || 'localhost',
        port: parseInt(process.env['DB_PORT'] || '5432'),
        database: process.env['DB_NAME'] || 'comfy_mqtt',
        user: process.env['DB_USER'] || 'comfy_mqtt',
        password: process.env['DB_PASSWORD'] || 'comfy_mqtt_password',
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

  async createTables(): Promise<void> {
    if (!this.pool) throw new Error('Database not initialized');
    
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

  async addTopic(topicName: string, schema: Record<string, any>, useDedicatedTable: boolean = false): Promise<void> {
    if (!this.pool) throw new Error('Database not initialized');
    
    const client = await this.pool.connect();
    try {
      // Insert topic into topics table
      await client.query(
        'INSERT INTO topics (name, schema, use_dedicated_table) VALUES ($1, $2, $3) ON CONFLICT (name) DO UPDATE SET schema = $2, use_dedicated_table = $3',
        [topicName, JSON.stringify(schema), useDedicatedTable]
      );
      
      // Create topic-specific table if requested
      if (useDedicatedTable) {
        await this.createTopicTable(topicName);
      }
      
      logger.info(`Topic ${topicName} added successfully with ${useDedicatedTable ? 'dedicated' : 'generic'} table`);
    } finally {
      client.release();
    }
  }

  async createTopicTable(topicName: string): Promise<string> {
    if (!this.pool) throw new Error('Database not initialized');
    
    const client = await this.pool.connect();
    try {
      const tableName = getTopicTableName(topicName);
      
      // Get the schema for this topic to create appropriate columns
      const schemaResult = await client.query(
        'SELECT schema FROM topics WHERE name = $1',
        [topicName]
      );
      
      if (schemaResult.rows.length === 0) {
        throw new Error(`Topic ${topicName} not found`);
      }
      
      const schema = schemaResult.rows[0].schema;
      const columns = this.generateColumnsFromSchema(schema);
      
      // Create table for this topic with schema-based columns
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
          id SERIAL PRIMARY KEY,
          ${columns.join(',\n          ')},
          received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create index for better performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_${tableName}_received 
        ON ${tableName}(received_at ASC)
      `);
      
      logger.info(`Table ${tableName} created for topic ${topicName} with schema-based columns`);
      return tableName;
    } finally {
      client.release();
    }
  }

  generateColumnsFromSchema(schema: Record<string, any>): string[] {
    const columns: string[] = [];
    
    for (const [fieldName, fieldType] of Object.entries(schema)) {
      // Sanitize field name for column name
      const columnName = fieldName.replace(/[^a-zA-Z0-9]/g, '_');
      
      // Map Joi types to PostgreSQL types
      let pgType = 'TEXT'; // default
      
      if (typeof fieldType === 'string') {
        switch (fieldType.toLowerCase()) {
          case 'number':
          case 'integer':
            pgType = 'NUMERIC';
            break;
          case 'boolean':
            pgType = 'BOOLEAN';
            break;
          case 'date':
          case 'timestamp':
            pgType = 'TIMESTAMP';
            break;
          case 'array':
            pgType = 'JSONB';
            break;
          case 'object':
            pgType = 'JSONB';
            break;
          default:
            pgType = 'TEXT';
        }
      } else if (typeof fieldType === 'object') {
        // Handle nested objects or arrays
        pgType = 'JSONB';
      }
      
      columns.push(`${columnName} ${pgType}`);
    }
    
    return columns;
  }

  async getTopics(): Promise<Topic[]> {
    if (!this.pool) throw new Error('Database not initialized');
    
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

  async getTopic(topicName: string): Promise<Topic | null> {
    if (!this.pool) throw new Error('Database not initialized');
    
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM topics WHERE name = $1',
        [topicName]
      );
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } finally {
      client.release();
    }
  }

  async getTopicSchema(topicName: string): Promise<Record<string, any> | null> {
    if (!this.pool) throw new Error('Database not initialized');
    
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

  async storeMessage(topicName: string, payload: Record<string, any>): Promise<number> {
    if (!this.pool) throw new Error('Database not initialized');
    
    const client = await this.pool.connect();
    try {
      // Check if topic uses dedicated table
      const topicResult = await client.query(
        'SELECT use_dedicated_table FROM topics WHERE name = $1',
        [topicName]
      );
      
      if (topicResult.rows.length === 0) {
        throw new Error(`Topic ${topicName} not found`);
      }
      
      const useDedicatedTable = topicResult.rows[0].use_dedicated_table;
      
      if (useDedicatedTable) {
        // Use dedicated topic table with schema-based columns
        const tableName = getTopicTableName(topicName);
        
        // Get the schema to map payload to columns
        const schemaResult = await client.query(
          'SELECT schema FROM topics WHERE name = $1',
          [topicName]
        );
        
        if (schemaResult.rows.length === 0) {
          throw new Error(`Topic ${topicName} not found`);
        }
        
        const schema = schemaResult.rows[0].schema;
        const { columns, values } = this.mapPayloadToColumns(payload, schema);
        
        const result = await client.query(
          `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
          values
        );
        
        // Manage retention after successful insert
        const deletedRows = await this.manageTableRetention(tableName);
        if (deletedRows > 0) {
          logger.info(`Retention: ${deletedRows} old rows deleted from ${tableName}`);
        }
        
        logger.info(`Message stored for topic ${topicName} with ID ${result.rows[0].id} (dedicated table)`);
        return result.rows[0].id;
      } else {
        // Use generic messages table
        const result = await client.query(
          'INSERT INTO messages (topic_name, payload) VALUES ($1, $2) RETURNING id',
          [topicName, JSON.stringify(payload)]
        );
        
        // Manage retention after successful insert
        const deletedRows = await this.manageTableRetention('messages');
        if (deletedRows > 0) {
          logger.info(`Retention: ${deletedRows} old rows deleted from messages table`);
        }
        
        logger.info(`Message stored for topic ${topicName} with ID ${result.rows[0].id} (generic table)`);
        return result.rows[0].id;
      }
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === '42P01') { // Table doesn't exist
        logger.warn(`Dedicated table doesn't exist for topic ${topicName}, creating it now`);
        await this.createTopicTable(topicName);
        
        // Retry the insert with the new table structure
        const schemaResult = await client.query(
          'SELECT schema FROM topics WHERE name = $1',
          [topicName]
        );
        
        if (schemaResult.rows.length === 0) {
          throw new Error(`Topic ${topicName} not found`);
        }
        
        const schema = schemaResult.rows[0].schema;
        const { columns, values } = this.mapPayloadToColumns(payload, schema);
        const tableName = getTopicTableName(topicName);
        
        const result = await client.query(
          `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
          values
        );
        
        // Manage retention after successful insert
        const deletedRows = await this.manageTableRetention(tableName);
        if (deletedRows > 0) {
          logger.info(`Retention: ${deletedRows} old rows deleted from ${tableName}`);
        }
        
        logger.info(`Message stored for topic ${topicName} with ID ${result.rows[0].id}`);
        return result.rows[0].id;
      }
      throw error;
    } finally {
      client.release();
    }
  }

  mapPayloadToColumns(payload: Record<string, any>, schema: Record<string, any>): { columns: string[], values: any[] } {
    const columns: string[] = [];
    const values: any[] = [];
    
    for (const [fieldName, fieldType] of Object.entries(schema)) {
      // Sanitize field name for column name
      const columnName = fieldName.replace(/[^a-zA-Z0-9]/g, '_');
      columns.push(columnName);
      
      // Get the value from payload
      const value = payload[fieldName];
      
      // Convert value based on field type
      let convertedValue = value;
      
      if (typeof fieldType === 'string') {
        switch (fieldType.toLowerCase()) {
          case 'number':
          case 'integer':
            convertedValue = value !== null && value !== undefined ? parseFloat(value) : null;
            break;
          case 'boolean':
            convertedValue = value !== null && value !== undefined ? Boolean(value) : null;
            break;
          case 'date':
          case 'timestamp':
            convertedValue = value !== null && value !== undefined ? new Date(value) : null;
            break;
          case 'array':
          case 'object':
            convertedValue = value !== null && value !== undefined ? JSON.stringify(value) : null;
            break;
          default:
            convertedValue = value !== null && value !== undefined ? String(value) : null;
        }
      } else if (typeof fieldType === 'object') {
        // Handle nested objects or arrays
        convertedValue = value !== null && value !== undefined ? JSON.stringify(value) : null;
      }
      
      values.push(convertedValue);
    }
    
    return { columns, values };
  }

  async getMessages(topicName: string, limit: number | null = null, offset: number = 0, includeMetadata: boolean = false, order: 'asc' | 'desc' = 'asc'): Promise<MessageWithMetadata[]> {
    if (!this.pool) throw new Error('Database not initialized');
    
    const client = await this.pool.connect();
    try {
      // Check if topic uses dedicated table
      const topicResult = await client.query(
        'SELECT use_dedicated_table FROM topics WHERE name = $1',
        [topicName]
      );
      
      if (topicResult.rows.length === 0) {
        throw new Error(`Topic ${topicName} not found`);
      }
      
      const useDedicatedTable = topicResult.rows[0].use_dedicated_table;
      
      if (useDedicatedTable) {
        // Use dedicated topic table with schema-based columns
        const tableName = getTopicTableName(topicName);
        
        // Get the schema to reconstruct payload from columns
        const schemaResult = await client.query(
          'SELECT schema FROM topics WHERE name = $1',
          [topicName]
        );
        
        if (schemaResult.rows.length === 0) {
          throw new Error(`Topic ${topicName} not found`);
        }
        
        const schema = schemaResult.rows[0].schema;
        const columns = Object.keys(schema).map(fieldName => 
          fieldName.replace(/[^a-zA-Z0-9]/g, '_')
        );
        
        const selectColumns = includeMetadata 
          ? `id, received_at, ${columns.join(', ')}`
          : columns.join(', ');
        
        let query = `SELECT ${selectColumns} FROM ${tableName} ORDER BY received_at ${order.toUpperCase()}`;
        let params: any[] = [];
        
        if (limit) {
          query += ` LIMIT $1 OFFSET $2`;
          params = [limit, offset];
        } else {
          query += ` OFFSET $1`;
          params = [offset];
        }
        
        const result = await client.query(query, params);
        
        // Reconstruct payload from columns
        return result.rows.map(row => {
          const payload: MessageWithMetadata = {};
          
          if (includeMetadata) {
            payload._id = row.id;
            payload._received_at = row.received_at;
          }
          
          for (const [fieldName, fieldType] of Object.entries(schema)) {
            const columnName = fieldName.replace(/[^a-zA-Z0-9]/g, '_');
            let value = row[columnName];
            
            // Convert value back based on field type
            if (typeof fieldType === 'string') {
              switch (fieldType.toLowerCase()) {
                case 'array':
                case 'object':
                  value = value ? JSON.parse(value) : null;
                  break;
                // Other types are already in correct format
              }
            } else if (typeof fieldType === 'object') {
              value = value ? JSON.parse(value) : null;
            }
            
            payload[fieldName] = value;
          }
          return payload;
        });
      } else {
        // Use generic messages table
        const selectColumns = includeMetadata ? 'id, received_at, payload' : 'payload';
        let query = `SELECT ${selectColumns} FROM messages WHERE topic_name = $1 ORDER BY received_at ${order.toUpperCase()}`;
        let params: any[] = [topicName];
        
        if (limit) {
          query += ` LIMIT $2 OFFSET $3`;
          params.push(limit, offset);
        } else {
          query += ` OFFSET $2`;
          params.push(offset);
        }
        
        const result = await client.query(query, params);
        
        return result.rows.map(row => {
          const payload: MessageWithMetadata = row.payload;
          if (includeMetadata) {
            payload._id = row.id;
            payload._received_at = row.received_at;
          }
          return payload;
        });
      }
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === '42P01') { // Table doesn't exist
        logger.warn(`Dedicated table doesn't exist for topic ${topicName}`);
        return [];
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteTopic(topicName: string): Promise<void> {
    if (!this.pool) throw new Error('Database not initialized');
    
    const client = await this.pool.connect();
    try {
      // Check if topic uses dedicated table
      const topicResult = await client.query(
        'SELECT use_dedicated_table FROM topics WHERE name = $1',
        [topicName]
      );
      
      if (topicResult.rows.length === 0) {
        logger.warn(`Topic ${topicName} not found for deletion`);
        return;
      }
      
      const useDedicatedTable = topicResult.rows[0].use_dedicated_table;
      
      // Delete topic from topics table (this will cascade delete from messages table if needed)
      await client.query('DELETE FROM topics WHERE name = $1', [topicName]);
      
      // Drop the topic-specific table if it exists
      if (useDedicatedTable) {
        const tableName = getTopicTableName(topicName);
        await client.query(`DROP TABLE IF EXISTS ${tableName}`);
        logger.info(`Topic ${topicName} and its dedicated table ${tableName} deleted successfully`);
      } else {
        logger.info(`Topic ${topicName} deleted successfully (messages cleaned up via cascade)`);
      }
    } finally {
      client.release();
    }
  }

  /**
   * Manages table retention by checking size and removing old rows if needed
   * @param tableName The name of the table to check
   * @returns Number of rows deleted (0 if no action taken)
   */
  async manageTableRetention(tableName: string): Promise<number> {
    if (!this.pool) throw new Error('Database not initialized');
    
    const client = await this.pool.connect();
    try {
      // Check current table size
      const sizeResult = await client.query(
        "SELECT pg_total_relation_size($1) AS total_size_bytes",
        [tableName]
      );

      if (sizeResult.rows.length === 0) {
        logger.warn(`Table ${tableName} not found for retention check`);
        return 0;
      }
      
      const currentSizeBytes = parseInt(sizeResult.rows[0].total_size_bytes);
      const currentSizeKB = currentSizeBytes / 1024;
      
      logger.debug(`Table ${tableName} current size: ${currentSizeKB.toFixed(2)} KB (max: ${this.maxTableSizeKB} KB)`);
      
      // If table is under the limit, no action needed
      if (currentSizeKB <= this.maxTableSizeKB) {
        return 0;
      }
      
      // Get row count to calculate average row size
      const countResult = await client.query(
        `SELECT COUNT(*) as row_count FROM ${tableName}`
      );
      
      const rowCount = parseInt(countResult.rows[0].row_count);
      if (rowCount === 0) {
        return 0;
      }
      
      // Calculate average row size and how many rows to remove
      const averageRowSizeKB = currentSizeKB / rowCount;
      const targetSizeKB = this.maxTableSizeKB * 0.8; // 80% of max size
      const excessSizeKB = currentSizeKB - targetSizeKB;
      const rowsToDelete = Math.ceil(excessSizeKB / averageRowSizeKB);
      
      if (rowsToDelete <= 0) {
        return 0;
      }
      
      // Delete oldest rows (assuming they have an id or timestamp column)
      const deleteResult = await client.query(
        `DELETE FROM ${tableName} WHERE id IN (
          SELECT id FROM ${tableName} 
          ORDER BY received_at ASC, id ASC 
          LIMIT $1
        )`,
        [rowsToDelete]
      );
      
      const deletedRows = deleteResult.rowCount || 0;
      
      if (deletedRows > 0) {
        logger.info(`Retention: Deleted ${deletedRows} rows from ${tableName} to maintain size limit`);
        
        // Run VACUUM FULL to reclaim space and update statistics
        try {
          logger.debug(`Running VACUUM FULL on ${tableName} to reclaim space...`);
          await client.query(`VACUUM FULL ${tableName}`);
          logger.info(`VACUUM FULL completed for ${tableName}`);
        } catch (vacuumError) {
          logger.warn(`VACUUM FULL failed for ${tableName}:`, vacuumError);
          // Don't fail the retention process if VACUUM fails
        }
      }
      
      return deletedRows;
      
    } catch (error) {
      logger.error(`Error managing retention for table ${tableName}:`, error);
      return 0;
    } finally {
      client.release();
    }
  }

  close(): void {
    if (this.pool) {
      this.pool.end();
      logger.info('PostgreSQL database connection closed');
    }
  }
}

export default new PostgreSQLDatabase(); 
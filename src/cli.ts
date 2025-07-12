#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import os from 'os';
import inquirer from 'inquirer';
import chalk from 'chalk';
import dotenv from 'dotenv';

interface SetupConfig {
  port: string;
  nodeEnv: string;
  logLevel: string;
  mqttHost: string;
  mqttPort: string;
  mqttUsername: string;
  mqttPassword: string;
  mqttClientId: string;
  dbHost: string;
  dbPort: string;
  dbName: string;
  dbUser: string;
  dbPassword: string;
}

function getConfigPath(): string {
  return path.join(os.homedir(), '.comfy-mqtt');
}

async function checkConfigFile(): Promise<boolean> {
  const configPath = getConfigPath();
  return fs.existsSync(configPath);
}

async function createConfigFile(config: SetupConfig): Promise<void> {
  const envContent = `# Server Configuration
PORT=${config.port}
NODE_ENV=${config.nodeEnv}
LOG_LEVEL=${config.logLevel}

# MQTT Broker Configuration
MQTT_HOST=${config.mqttHost}
MQTT_PORT=${config.mqttPort}
MQTT_USERNAME=${config.mqttUsername}
MQTT_PASSWORD=${config.mqttPassword}
MQTT_CLIENT_ID=${config.mqttClientId}

# Database Configuration
DB_HOST=${config.dbHost}
DB_PORT=${config.dbPort}
DB_NAME=${config.dbName}
DB_USER=${config.dbUser}
DB_PASSWORD=${config.dbPassword}
`;

  const configPath = getConfigPath();
  fs.writeFileSync(configPath, envContent);
  console.log(chalk.green(`✓ Configuration saved to ${configPath}`));
}

async function promptForConfiguration(): Promise<SetupConfig> {
  console.log(chalk.blue('🔧 Comfy MQTT Setup'));
  console.log(chalk.gray('Let\'s configure your MQTT and PostgreSQL settings\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'port',
      message: 'Server port (default: 3000):',
      default: '3000',
      validate: (input: string) => {
        const port = parseInt(input);
        return port > 0 && port < 65536 ? true : 'Please enter a valid port number (1-65535)';
      }
    },
    {
      type: 'list',
      name: 'nodeEnv',
      message: 'Environment:',
      choices: ['development', 'production'],
      default: 'development'
    },
    {
      type: 'list',
      name: 'logLevel',
      message: 'Log level:',
      choices: ['error', 'warn', 'info', 'debug'],
      default: 'info'
    },
    {
      type: 'input',
      name: 'mqttHost',
      message: 'MQTT Broker host:',
      default: 'localhost',
      validate: (input: string) => input.trim() ? true : 'MQTT host is required'
    },
    {
      type: 'input',
      name: 'mqttPort',
      message: 'MQTT Broker port (default: 1883):',
      default: '1883',
      validate: (input: string) => {
        const port = parseInt(input);
        return port > 0 && port < 65536 ? true : 'Please enter a valid port number (1-65535)';
      }
    },
    {
      type: 'input',
      name: 'mqttUsername',
      message: 'MQTT Username (optional):',
      default: ''
    },
    {
      type: 'password',
      name: 'mqttPassword',
      message: 'MQTT Password (optional):',
      default: ''
    },
    {
      type: 'input',
      name: 'mqttClientId',
      message: 'MQTT Client ID (default: comfy-mqtt-server):',
      default: 'comfy-mqtt-server'
    },
    {
      type: 'input',
      name: 'dbHost',
      message: 'PostgreSQL host:',
      default: 'localhost',
      validate: (input: string) => input.trim() ? true : 'Database host is required'
    },
    {
      type: 'input',
      name: 'dbPort',
      message: 'PostgreSQL port (default: 5432):',
      default: '5432',
      validate: (input: string) => {
        const port = parseInt(input);
        return port > 0 && port < 65536 ? true : 'Please enter a valid port number (1-65535)';
      }
    },
    {
      type: 'input',
      name: 'dbName',
      message: 'PostgreSQL database name:',
      default: 'comfy_mqtt',
      validate: (input: string) => input.trim() ? true : 'Database name is required'
    },
    {
      type: 'input',
      name: 'dbUser',
      message: 'PostgreSQL username:',
      default: 'comfy_mqtt',
      validate: (input: string) => input.trim() ? true : 'Database username is required'
    },
    {
      type: 'password',
      name: 'dbPassword',
      message: 'PostgreSQL password:',
      validate: (input: string) => input.trim() ? true : 'Database password is required'
    }
  ]);

  return answers;
}

async function showSummary(config: SetupConfig): Promise<boolean> {
  console.log(chalk.blue('\n📋 Configuration Summary:'));
  console.log(chalk.gray('─'.repeat(50)));
  
  console.log(chalk.cyan('Server:'));
  console.log(`  Port: ${config.port}`);
  console.log(`  Environment: ${config.nodeEnv}`);
  console.log(`  Log Level: ${config.logLevel}`);
  
  console.log(chalk.cyan('\nMQTT Broker:'));
  console.log(`  Host: ${config.mqttHost}:${config.mqttPort}`);
  console.log(`  Username: ${config.mqttUsername || 'Not set'}`);
  console.log(`  Client ID: ${config.mqttClientId}`);
  
  console.log(chalk.cyan('\nPostgreSQL Database:'));
  console.log(`  Host: ${config.dbHost}:${config.dbPort}`);
  console.log(`  Database: ${config.dbName}`);
  console.log(`  Username: ${config.dbUser}`);
  
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Does this configuration look correct?',
      default: true
    }
  ]);

  return confirm;
}

async function startServer(): Promise<void> {
  console.log(chalk.blue('\n🚀 Starting Comfy MQTT server...'));
  
  // Load environment variables from the config file
  const configPath = getConfigPath();
  const result = dotenv.config({ path: configPath });
  
  if (result.error) {
    console.error(chalk.red('Error loading configuration:'), result.error);
    process.exit(1);
  }
  
  // Import and start the server
  const app = await import('./app');
  
  try {
    // The app will start automatically when imported
    console.log(chalk.green('✓ Server started successfully'));
  } catch (error) {
    console.error(chalk.red('Failed to start server:'), error);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  try {
    const hasConfigFile = await checkConfigFile();
    
    if (!hasConfigFile) {
      console.log(chalk.yellow('⚠️  No configuration found. Starting setup...\n'));
      console.log(chalk.gray(`Configuration will be saved to: ${getConfigPath()}\n`));
      
      const config = await promptForConfiguration();
      const confirmed = await showSummary(config);
      
      if (confirmed) {
        await createConfigFile(config);
        console.log(chalk.green('\n✅ Setup completed successfully!'));
      } else {
        console.log(chalk.yellow('\n❌ Setup cancelled. Please run the command again to retry.'));
        process.exit(0);
      }
    } else {
      console.log(chalk.green('✓ Configuration found'));
    }
    
    await startServer();
  } catch (error) {
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
} 
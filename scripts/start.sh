#!/bin/bash

# Comfy MQTT Quick Start Script

echo "🚀 Starting Comfy MQTT..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p data logs mosquitto/config mosquitto/data mosquitto/log

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp env.example .env
    echo "⚠️  Please edit .env file with your MQTT broker configuration"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if MQTT broker is running (optional)
echo "🔍 Checking MQTT broker connection..."
if command -v mosquitto_pub &> /dev/null; then
    echo "✅ Mosquitto client found"
else
    echo "⚠️  Mosquitto client not found. You can install it or use Docker."
fi

echo ""
echo "🎯 Ready to start! Choose an option:"
echo "1. Start with Docker (recommended for first time)"
echo "2. Start locally (requires MQTT broker)"
echo "3. Exit"
echo ""
read -p "Enter your choice (1-3): " choice

case $choice in
    1)
        echo "🐳 Starting with Docker..."
        docker-compose up -d
        echo "✅ Services started! API available at http://localhost:3000"
        echo "📊 Health check: http://localhost:3000/api/health"
        ;;
    2)
        echo "💻 Starting locally..."
        echo "⚠️  Make sure your MQTT broker is running and configured in .env"
        npm start
        ;;
    3)
        echo "👋 Goodbye!"
        exit 0
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac 
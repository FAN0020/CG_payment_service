#!/bin/bash

# Start the payment service in development mode
echo "🚀 Starting ClassGuru Payment Service..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please copy .env.example to .env and configure your Stripe keys"
    exit 1
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Kill any existing server on port 8790
echo "🔍 Checking for existing server on port 8790..."
lsof -ti :8790 | xargs kill -9 2>/dev/null || echo "No existing server found"

# Start the server
echo "🎯 Starting server on port 8790..."
npx tsx src/server.ts



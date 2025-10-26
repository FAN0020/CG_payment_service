#!/bin/bash

# Deployment script for ClassGuru Payment Service
set -e

echo "🚀 Deploying ClassGuru Payment Service..."

# Navigate to the docker directory
cd "$(dirname "$0")"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker daemon first."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose > /dev/null 2>&1; then
    echo "❌ docker-compose is not installed. Please install docker-compose first."
    exit 1
fi

# Build and start the service
echo "📦 Building and starting the service..."
docker-compose up -d --build

# Wait for the service to be healthy
echo "⏳ Waiting for service to be healthy..."
timeout=60
counter=0

while [ $counter -lt $timeout ]; do
    if docker-compose ps | grep -q "healthy"; then
        echo "✅ Service is healthy!"
        break
    fi
    
    echo "⏳ Still waiting... ($counter/$timeout seconds)"
    sleep 5
    counter=$((counter + 5))
done

if [ $counter -ge $timeout ]; then
    echo "⚠️  Service may not be fully healthy yet. Check logs with: docker-compose logs"
fi

# Show service status
echo ""
echo "📊 Service Status:"
docker-compose ps

echo ""
echo "🌐 Service is running at: http://localhost:8790"
echo "📋 To view logs: docker-compose logs -f"
echo "🛑 To stop: docker-compose down"
echo ""
echo "✅ Deployment completed!"

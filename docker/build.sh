#!/bin/bash

# Build script for ClassGuru Payment Service Docker image
set -e

echo "🚀 Building ClassGuru Payment Service Docker image..."

# Navigate to the payment service root directory
cd "$(dirname "$0")/.."

# Ensure the project is built
echo "📦 Building TypeScript project..."
npm run build

# Build Docker image
echo "🐳 Building Docker image..."
docker build -f docker/Dockerfile -t classguru-payment-service:latest .

echo "✅ Docker image built successfully!"
echo "📋 Image: classguru-payment-service:latest"
echo ""
echo "🚀 To run the container:"
echo "   docker run -p 8790:8790 --env-file env.txt classguru-payment-service:latest"
echo ""
echo "🐳 To run with docker-compose:"
echo "   cd docker && docker-compose up -d"

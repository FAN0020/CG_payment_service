#!/bin/bash

# Test script to validate Docker setup without building
set -e

echo "🧪 Testing ClassGuru Payment Service Docker setup..."

# Navigate to the payment service root directory
cd "$(dirname "$0")/.."

echo "✅ Checking project structure..."

# Check if dist directory exists and has compiled files
if [ ! -d "dist" ]; then
    echo "❌ dist/ directory not found. Run 'npm run build' first."
    exit 1
fi

if [ ! -f "dist/server.js" ]; then
    echo "❌ dist/server.js not found. Build may be incomplete."
    exit 1
fi

echo "✅ Compiled files found in dist/"

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found"
    exit 1
fi

echo "✅ package.json found"

# Check if env.txt exists
if [ ! -f "env.txt" ]; then
    echo "❌ env.txt not found"
    exit 1
fi

echo "✅ env.txt found"

# Check if Dockerfile exists
if [ ! -f "docker/Dockerfile" ]; then
    echo "❌ docker/Dockerfile not found"
    exit 1
fi

echo "✅ Dockerfile found"

# Check if .dockerignore exists
if [ ! -f "docker/.dockerignore" ]; then
    echo "❌ docker/.dockerignore not found"
    exit 1
fi

echo "✅ .dockerignore found"

# Check if docker-compose.yml exists
if [ ! -f "docker/docker-compose.yml" ]; then
    echo "❌ docker/docker-compose.yml not found"
    exit 1
fi

echo "✅ docker-compose.yml found"

# Validate that source files are excluded
echo "🔍 Checking .dockerignore effectiveness..."

# Check if src directory would be excluded
if grep -q "^src/" docker/.dockerignore; then
    echo "✅ src/ directory will be excluded from Docker build"
else
    echo "⚠️  src/ directory may not be excluded from Docker build"
fi

# Check if TypeScript files would be excluded
if grep -q "\.ts$" docker/.dockerignore; then
    echo "✅ TypeScript files will be excluded from Docker build"
else
    echo "⚠️  TypeScript files may not be excluded from Docker build"
fi

echo ""
echo "🎉 Docker setup validation completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Start Docker daemon"
echo "2. Run: ./build.sh"
echo "3. Or run: docker-compose up -d"
echo ""
echo "📁 Files created:"
echo "   - docker/Dockerfile"
echo "   - docker/.dockerignore"
echo "   - docker/docker-compose.yml"
echo "   - docker/build.sh"
echo "   - docker/README.md"

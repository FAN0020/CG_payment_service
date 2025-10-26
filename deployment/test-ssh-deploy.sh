#!/bin/bash

# Test script for SSH deploy key functionality
echo "=== SSH Deploy Key Test ==="
echo "Building Docker image..."

# Build the Docker image
docker build -t ssh-deploy-test -f Dockerfile .

if [ $? -eq 0 ]; then
    echo "Docker image built successfully!"
    echo ""
    echo "Running SSH deploy key test..."
    echo "=========================================="
    
    # Run the Docker container
    docker run --rm ssh-deploy-test
    
    echo "=========================================="
    echo "Test completed!"
else
    echo "ERROR: Failed to build Docker image"
    exit 1
fi


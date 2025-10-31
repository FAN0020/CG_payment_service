#!/bin/bash

# Setup script for SSH deploy key
# This script helps generate and configure the SSH deploy key for Docker builds

set -e

echo "🔑 Setting up SSH Deploy Key for Docker Build"
echo "=============================================="

# Check if deploy_key already exists
if [ -f "deploy_key" ]; then
    echo "⚠️  deploy_key already exists!"
    read -p "Do you want to regenerate it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -f deploy_key deploy_key.pub
    else
        echo "✅ Using existing deploy_key"
        exit 0
    fi
fi

# Generate SSH key pair
echo "🔧 Generating SSH key pair..."
ssh-keygen -t ed25519 -f deploy_key -C "deploy-key-$(date +%Y%m%d)" -N ""

echo "✅ SSH key pair generated successfully!"
echo ""

# Display public key
echo "📋 PUBLIC KEY (add this to GitHub):"
echo "=================================="
cat deploy_key.pub
echo ""

echo "📝 Next steps:"
echo "1. Copy the public key above"
echo "2. Go to your GitHub repository → Settings → Deploy keys"
echo "3. Click 'Add deploy key'"
echo "4. Paste the public key and give it a title (e.g., 'Docker Deploy Key')"
echo "5. Make sure 'Allow write access' is UNCHECKED (read-only is sufficient)"
echo "6. Click 'Add key'"
echo ""

echo "🔒 Security notes:"
echo "- Private key (deploy_key) is automatically excluded from git"
echo "- Key will be cleaned up after Docker build"
echo "- Only used during build process, not in runtime"
echo ""

echo "✅ Setup complete! You can now run: docker build -f docker/Dockerfile -t classguru-payment-service ."



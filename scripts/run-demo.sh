#!/bin/bash

# ClassGuru Payment Service - Demo Runner
# This script starts the payment service with enhanced logging for demo purposes

echo "================================================================================"
echo "ClassGuru Payment Service - Demo Mode"
echo "================================================================================"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo ""
    echo "Please create a .env file from env.example:"
    echo "  cp env.example .env"
    echo ""
    echo "Then configure your Stripe keys and other settings."
    echo "================================================================================"
    exit 1
fi

echo "✅ Environment file found"
echo ""

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

echo "================================================================================"
echo "Starting Payment Service"
echo "================================================================================"
echo ""
echo "📍 Payment Page:  http://localhost:8790/payment"
echo "✅ Success Page:  http://localhost:8790/payment/success"
echo "❌ Cancel Page:   http://localhost:8790/payment/cancel"
echo "💳 API Endpoint:  http://localhost:8790/api/payment/create-subscription"
echo "🏥 Health Check:  http://localhost:8790/api/payment/health"
echo ""
echo "================================================================================"
echo "Demo Instructions"
echo "================================================================================"
echo ""
echo "1. Open http://localhost:8790/payment in your browser"
echo "2. You'll be prompted for a JWT token (first time only)"
echo "3. Run 'npm run generate-jwt' in another terminal to get a token"
echo "4. Select a payment plan and click the button"
echo "5. Use Stripe test card: 4242 4242 4242 4242"
echo "6. Check the console logs below for detailed flow tracking"
echo ""
echo "================================================================================"
echo "Server Logs (Press Ctrl+C to stop)"
echo "================================================================================"
echo ""

# Run the development server
npm run dev


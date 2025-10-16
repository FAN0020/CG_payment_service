#!/bin/bash

# ClassGuru Payment Service - Server Status Checker
# Usage: ./check-server.sh

echo "================================================"
echo "  ClassGuru Payment Service - Status Check"
echo "================================================"
echo ""

# Check if server is running
echo "🔍 Checking server status..."
if lsof -i :8790 > /dev/null 2>&1; then
    echo "✅ Server is RUNNING"
    echo ""
    lsof -i :8790 | head -3
    echo ""
else
    echo "❌ Server is NOT running"
    echo ""
    echo "💡 To start the server:"
    echo "   cd /Users/fanyupei/Codes/ClassGuruAI/CG_payment_service"
    echo "   PORT=8790 npm run dev"
    echo ""
    exit 1
fi

# Test health endpoint
echo "🏥 Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s http://localhost:8790/api/payment/health 2>/dev/null)

if [ -n "$HEALTH_RESPONSE" ]; then
    echo "✅ Health endpoint responding"
    echo "   Response: $HEALTH_RESPONSE"
else
    echo "❌ Health endpoint not responding"
    exit 1
fi

echo ""

# Test payment page
echo "📄 Testing payment page..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8790/payment 2>/dev/null)

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Payment page accessible (HTTP $HTTP_CODE)"
else
    echo "❌ Payment page error (HTTP $HTTP_CODE)"
    exit 1
fi

echo ""

# Test success page
echo "📄 Testing success page..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8790/payment/success 2>/dev/null)

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Success page accessible (HTTP $HTTP_CODE)"
else
    echo "❌ Success page error (HTTP $HTTP_CODE)"
fi

echo ""

# Test cancel page
echo "📄 Testing cancel page..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8790/payment/cancel 2>/dev/null)

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Cancel page accessible (HTTP $HTTP_CODE)"
else
    echo "❌ Cancel page error (HTTP $HTTP_CODE)"
fi

echo ""
echo "================================================"
echo "  ✅ All Systems Operational!"
echo "================================================"
echo ""
echo "📍 URLs:"
echo "   Payment Page: http://localhost:8790/payment"
echo "   Health Check: http://localhost:8790/api/payment/health"
echo ""
echo "💡 Next Steps:"
echo "   1. Open http://localhost:8790/payment in your browser"
echo "   2. Generate JWT: npm run generate-jwt"
echo "   3. Start testing!"
echo ""


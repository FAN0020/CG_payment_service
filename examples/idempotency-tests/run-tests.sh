#!/bin/bash

echo "=========================================="
echo "  Payment Service Idempotency Tests"
echo "=========================================="
echo ""

# Kill any existing service
echo "Stopping any existing service..."
pkill -f "tsx watch" 2>/dev/null || true
sleep 2

# Start the service in background
echo "Starting payment service with mock Stripe..."
cd "$(dirname "$0")/../.."

export STRIPE_SECRET_KEY="sk_test_mock_12345678901234567890123456789012"
export STRIPE_MONTHLY_PRICE_ID="price_mock_monthly"
export STRIPE_WEBHOOK_SECRET="whsec_test_mock_12345678901234567890123"
export JWT_SECRET="demo_jwt_secret_at_least_32_characters_long_for_classguru_payment_service"

npm run dev > /tmp/payment-service.log 2>&1 &
SERVICE_PID=$!

echo "Service PID: $SERVICE_PID"
echo "Waiting for service to start..."

# Wait for service to be ready
for i in {1..15}; do
  if curl -s http://127.0.0.1:8790/api/payment/health > /dev/null 2>&1; then
    echo "✓ Service is ready!"
    break
  fi
  echo "  Waiting... ($i/15)"
  sleep 1
done

# Check if service is up
if ! curl -s http://127.0.0.1:8790/api/payment/health > /dev/null 2>&1; then
  echo "✗ Service failed to start. Check logs:"
  tail -50 /tmp/payment-service.log
  kill $SERVICE_PID 2>/dev/null
  exit 1
fi

echo ""
echo "Running tests..."
echo ""

# Run the tests
cd examples/idempotency-tests
node test-runner.js
TEST_EXIT=$?

echo ""
echo "=========================================="
echo "  Cleanup"
echo "=========================================="

# Cleanup
kill $SERVICE_PID 2>/dev/null
echo "Service stopped."

exit $TEST_EXIT


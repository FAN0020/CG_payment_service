#!/bin/bash

# ==========================================
# Payment Flow Testing Script
# ==========================================
# This script demonstrates the complete payment flow
# and all parameters transferred at each step

set -e

BASE_URL="http://localhost:8790"
API_URL="$BASE_URL/api/payment"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}   Payment Flow Test - Parameter Tracking${NC}"
echo -e "${BLUE}================================================${NC}\n"

# ==========================================
# STEP 1: Generate JWT Token
# ==========================================
echo -e "${GREEN}[STEP 1] Generating JWT Token${NC}"
echo "Parameters sent:"
echo "  - user_id: test_user_123"
echo "  - email: test@example.com"
echo ""

JWT_TOKEN=$(node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign(
  { sub: 'test_user_123', email: 'test@example.com' },
  'demo-secret-key-change-in-production-minimum-32-characters-for-security',
  { expiresIn: '24h' }
);
console.log(token);
")

echo "✅ JWT Token generated: ${JWT_TOKEN:0:50}..."
echo ""

# ==========================================
# STEP 2: Create Subscription
# ==========================================
echo -e "${GREEN}[STEP 2] Create Subscription Request${NC}"
IDEMPOTENCY_KEY="test_$(date +%s)"

echo "POST $API_URL/create-subscription"
echo ""
echo "Parameters sent:"
cat <<EOF
{
  "jwt": "$JWT_TOKEN",
  "idempotency_key": "$IDEMPOTENCY_KEY",
  "payment_gateway": "stripe",
  "product_id": "monthly-plan",
  "currency": "SGD",
  "payment_method": "card",
  "customer_email": "test@example.com",
  "platform": "web",
  "client_ref": "test_client"
}
EOF
echo ""

RESPONSE=$(curl -s -X POST "$API_URL/create-subscription" \
  -H "Content-Type: application/json" \
  -d "{
    \"jwt\": \"$JWT_TOKEN\",
    \"idempotency_key\": \"$IDEMPOTENCY_KEY\",
    \"payment_gateway\": \"stripe\",
    \"product_id\": \"monthly-plan\",
    \"currency\": \"sgd\",
    \"payment_method\": \"card\",
    \"customer_email\": \"test@example.com\",
    \"platform\": \"web\",
    \"client_ref\": \"test_client\"
  }")

echo "Response received:"
echo "$RESPONSE" | jq '.'
echo ""

# Extract important values
CHECKOUT_URL=$(echo "$RESPONSE" | jq -r '.data.checkout_url')
ORDER_ID=$(echo "$RESPONSE" | jq -r '.data.order_id')
SESSION_ID=$(echo "$RESPONSE" | jq -r '.data.session_id')

echo -e "${YELLOW}Parameters returned:${NC}"
echo "  - checkout_url: $CHECKOUT_URL"
echo "  - order_id: $ORDER_ID"
echo "  - session_id: $SESSION_ID"
echo ""

# ==========================================
# STEP 3: Verify Order in Database
# ==========================================
echo -e "${GREEN}[STEP 3] Verify Order in Database${NC}"
echo "Querying database for order: $ORDER_ID"
echo ""

DB_PATH="data/payments.db"
if [ -f "$DB_PATH" ]; then
  echo "Order details:"
  sqlite3 "$DB_PATH" <<EOF
.mode column
.headers on
SELECT 
  order_id, 
  user_id, 
  status, 
  amount, 
  currency, 
  stripe_session_id,
  created_at 
FROM orders 
WHERE order_id = '$ORDER_ID';
EOF
  echo ""
else
  echo -e "${RED}⚠️  Database not found at $DB_PATH${NC}"
  echo ""
fi

# ==========================================
# STEP 4: Simulate Webhook (Success)
# ==========================================
echo -e "${GREEN}[STEP 4] Simulate Stripe Webhook (Payment Success)${NC}"
echo "POST $BASE_URL/webhooks/stripe"
echo ""
echo "Parameters sent (in webhook payload):"
cat <<EOF
{
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "$SESSION_ID",
      "metadata": {
        "order_id": "$ORDER_ID"
      },
      "subscription": "sub_mock_12345",
      "customer": "cus_mock_67890"
    }
  }
}
EOF
echo ""

# Create webhook payload
WEBHOOK_PAYLOAD=$(cat <<EOF
{
  "id": "evt_mock_$(date +%s)",
  "object": "event",
  "api_version": "2023-10-16",
  "created": $(date +%s),
  "data": {
    "object": {
      "id": "$SESSION_ID",
      "object": "checkout.session",
      "metadata": {
        "order_id": "$ORDER_ID"
      },
      "subscription": "sub_mock_12345",
      "customer": "cus_mock_67890"
    }
  },
  "type": "checkout.session.completed"
}
EOF
)

WEBHOOK_RESPONSE=$(curl -s -X POST "$BASE_URL/webhooks/stripe" \
  -H "Content-Type: application/json" \
  -H "stripe-signature: mock_signature_123" \
  -d "$WEBHOOK_PAYLOAD")

echo "Webhook response:"
echo "$WEBHOOK_RESPONSE" | jq '.'
echo ""

# ==========================================
# STEP 5: Verify Updated Order Status
# ==========================================
echo -e "${GREEN}[STEP 5] Verify Updated Order Status${NC}"
echo "Checking if order status changed to 'active'..."
echo ""

if [ -f "$DB_PATH" ]; then
  echo "Updated order details:"
  sqlite3 "$DB_PATH" <<EOF
.mode column
.headers on
SELECT 
  order_id, 
  user_id, 
  status, 
  stripe_subscription_id,
  stripe_customer_id,
  updated_at 
FROM orders 
WHERE order_id = '$ORDER_ID';
EOF
  echo ""
  
  STATUS=$(sqlite3 "$DB_PATH" "SELECT status FROM orders WHERE order_id = '$ORDER_ID';")
  if [ "$STATUS" = "active" ]; then
    echo -e "${GREEN}✅ Payment verified! Order is now ACTIVE${NC}"
  else
    echo -e "${YELLOW}⚠️  Order status: $STATUS (expected: active)${NC}"
  fi
else
  echo -e "${RED}⚠️  Database not found${NC}"
fi
echo ""

# ==========================================
# STEP 6: Verify Subscription API
# ==========================================
echo -e "${GREEN}[STEP 6] Verify Subscription via API${NC}"
echo "POST $API_URL/verify-subscription"
echo ""

VERIFY_RESPONSE=$(curl -s -X POST "$API_URL/verify-subscription" \
  -H "Content-Type: application/json" \
  -d "{\"jwt\": \"$JWT_TOKEN\"}")

echo "Response:"
echo "$VERIFY_RESPONSE" | jq '.'
echo ""

IS_ACTIVE=$(echo "$VERIFY_RESPONSE" | jq -r '.data.is_active')
if [ "$IS_ACTIVE" = "true" ]; then
  echo -e "${GREEN}✅ Subscription verification successful!${NC}"
else
  echo -e "${RED}❌ Subscription is not active${NC}"
fi
echo ""

# ==========================================
# SUMMARY
# ==========================================
echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}   PARAMETER FLOW SUMMARY${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo "1. Client → Backend (Create Subscription):"
echo "   ✓ JWT token (authentication)"
echo "   ✓ idempotency_key (prevent duplicates)"
echo "   ✓ product_id, currency, payment_method"
echo "   ✓ customer_email, platform, client_ref"
echo ""
echo "2. Backend → Client:"
echo "   ✓ checkout_url (Stripe or mock)"
echo "   ✓ order_id (internal tracking)"
echo "   ✓ session_id (Stripe session)"
echo ""
echo "3. Mock Checkout → Success Page:"
echo "   ✓ session_id (from URL param)"
echo "   ✓ order_id (from URL param)"
echo ""
echo "4. Stripe → Webhook:"
echo "   ✓ event.type (checkout.session.completed)"
echo "   ✓ session.id (Stripe session ID)"
echo "   ✓ metadata.order_id (our order ID)"
echo "   ✓ subscription (Stripe subscription ID)"
echo "   ✓ customer (Stripe customer ID)"
echo ""
echo "5. Webhook Updates Database:"
echo "   ✓ order_id → status: active"
echo "   ✓ stripe_subscription_id saved"
echo "   ✓ stripe_customer_id saved"
echo ""
echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}✅ Test Complete!${NC}"
echo -e "${BLUE}================================================${NC}"


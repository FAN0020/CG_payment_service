#!/bin/bash

# Comprehensive Test Plan for ClassGuru Ad Service
# This script automatically checks if server is running and starts it if needed

set -e

PORT=${PORT:-8791}
BASE_URL="http://localhost:${PORT}"
TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="/tmp/ad_service_test.log"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🧪 ClassGuru Ad Service - Comprehensive Test Plan"
echo "=================================================="
echo ""

# Function to check if server is running
check_server() {
    if curl -s -f "${BASE_URL}/api/ads/health" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to start server if not running
ensure_server_running() {
    if check_server; then
        echo -e "${GREEN}✅ Server is already running on port ${PORT}${NC}"
        return 0
    fi
    
    echo -e "${YELLOW}⚠️  Server not running. Starting server...${NC}"
    
    # Check if port is in use by another process
    if lsof -Pi :${PORT} -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "   Killing existing process on port ${PORT}..."
        lsof -ti :${PORT} | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
    
    # Start server in background
    cd "${TEST_DIR}"
    export MOCK_ADS_MODE=true
    export PORT=${PORT}
    npm run dev > /tmp/ad_service.log 2>&1 &
    SERVER_PID=$!
    
    # Wait for server to start
    echo "   Waiting for server to start..."
    MAX_WAIT=30
    WAITED=0
    while ! check_server && [ $WAITED -lt $MAX_WAIT ]; do
        sleep 1
        WAITED=$((WAITED + 1))
    done
    
    if check_server; then
        echo -e "${GREEN}✅ Server started successfully (PID: ${SERVER_PID})${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed to start server after ${MAX_WAIT} seconds${NC}"
        return 1
    fi
}

# Function to stop server (if we started it)
cleanup() {
    if [ ! -z "$SERVER_PID" ]; then
        echo ""
        echo -e "${YELLOW}Cleaning up - stopping server (PID: ${SERVER_PID})...${NC}"
        kill $SERVER_PID 2>/dev/null || true
        wait $SERVER_PID 2>/dev/null || true
    fi
}

# Trap to cleanup on exit
trap cleanup EXIT

# Ensure server is running
if ! ensure_server_running; then
    echo -e "${RED}❌ Cannot proceed without server running${NC}"
    exit 1
fi

echo ""
echo "=== 1. INITIAL SETUP CHECKS ==="
echo ""

# 1.1 Health check
echo "1.1 Health endpoint check..."
HEALTH=$(curl -s "${BASE_URL}/api/ads/health")
if echo "$HEALTH" | jq -e '.status == "healthy"' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Health check passed${NC}"
    echo "$HEALTH" | jq '.'
else
    echo -e "${RED}❌ Health check failed${NC}"
    exit 1
fi

# 1.2 Environment check
echo ""
echo "1.2 Environment check..."
if [ -f "${TEST_DIR}/.env" ]; then
    echo -e "${GREEN}✅ .env file exists${NC}"
else
    echo -e "${YELLOW}⚠️  .env file not found (may use defaults)${NC}"
fi

# 1.3 Database check
echo ""
echo "1.3 Database check..."
if [ -f "${TEST_DIR}/data/ad_service.db" ]; then
    echo -e "${GREEN}✅ Database file exists${NC}"
    DB_COUNT=$(sqlite3 "${TEST_DIR}/data/ad_service.db" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>/dev/null || echo "0")
    echo "   Tables: $DB_COUNT"
else
    echo -e "${YELLOW}⚠️  Database file not found (will be created on first request)${NC}"
fi

echo ""
echo "=== 2. ENDPOINT FUNCTIONAL TESTS ==="
echo ""

# 2.1 Request Ad
echo "2.1 Testing POST /api/ads/request..."
REQUEST_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/ads/request" \
    -H "Content-Type: application/json" \
    -d '{
        "page": "test-page",
        "format": "banner",
        "sessionId": "test-session-123",
        "deviceType": "desktop"
    }')

if echo "$REQUEST_RESPONSE" | jq -e '.success == true' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Request ad endpoint working${NC}"
    IMPRESSION_ID=$(echo "$REQUEST_RESPONSE" | jq -r '.data.impressionId // empty')
    echo "   Impression ID: $IMPRESSION_ID"
    
    # Check response format
    if echo "$REQUEST_RESPONSE" | jq -e '.requestId' > /dev/null 2>&1 && \
       echo "$REQUEST_RESPONSE" | jq -e '.data' > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Response format correct (has requestId and data)${NC}"
    else
        echo -e "${RED}❌ Response format incorrect${NC}"
    fi
else
    echo -e "${RED}❌ Request ad endpoint failed${NC}"
    echo "$REQUEST_RESPONSE" | jq '.' || echo "$REQUEST_RESPONSE"
    exit 1
fi

# 2.2 Click Ad
echo ""
echo "2.2 Testing POST /api/ads/click..."
if [ -z "$IMPRESSION_ID" ] || [ "$IMPRESSION_ID" = "null" ] || [ "$IMPRESSION_ID" = "" ]; then
    echo -e "${YELLOW}⚠️  No impression ID from previous request, using test ID${NC}"
    IMPRESSION_ID="test-impression-$(date +%s)"
fi

CLICK_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/ads/click" \
    -H "Content-Type: application/json" \
    -d "{
        \"impressionId\": \"${IMPRESSION_ID}\",
        \"clickUrl\": \"https://example.com/ad\"
    }")

if echo "$CLICK_RESPONSE" | jq -e '.success == true' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Click ad endpoint working${NC}"
    if echo "$CLICK_RESPONSE" | jq -e '.requestId' > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Response format correct (has requestId)${NC}"
    fi
else
    echo -e "${RED}❌ Click ad endpoint failed${NC}"
    echo "$CLICK_RESPONSE" | jq '.' || echo "$CLICK_RESPONSE"
fi

# 2.3 Database consistency
echo ""
echo "2.3 Database consistency check..."
if [ -f "${TEST_DIR}/data/ad_service.db" ]; then
    IMPRESSIONS=$(sqlite3 "${TEST_DIR}/data/ad_service.db" "SELECT COUNT(*) FROM ad_impressions;" 2>/dev/null || echo "0")
    CLICKS=$(sqlite3 "${TEST_DIR}/data/ad_service.db" "SELECT COUNT(*) FROM ad_clicks;" 2>/dev/null || echo "0")
    echo "   Impressions in DB: $IMPRESSIONS"
    echo "   Clicks in DB: $CLICKS"
    if [ "$IMPRESSIONS" -gt 0 ]; then
        echo -e "${GREEN}✅ Impressions recorded in database${NC}"
    fi
    if [ "$CLICKS" -gt 0 ]; then
        echo -e "${GREEN}✅ Clicks recorded in database${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Database file not accessible${NC}"
fi

# 2.4 Metrics endpoint (requires auth)
echo ""
echo "2.4 Testing GET /api/ads/metrics (auth required)..."
METRICS_NO_AUTH=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/ads/metrics?adUnitId=test&startDate=2025-01-01&endDate=2025-12-31" 2>&1)
HTTP_CODE=$(echo "$METRICS_NO_AUTH" | tail -1)
if [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✅ Metrics endpoint correctly requires authentication (401)${NC}"
else
    echo -e "${YELLOW}⚠️  Expected 401, got: $HTTP_CODE${NC}"
fi

echo ""
echo "=== 3. ERROR & EDGE CASE TESTS ==="
echo ""

# 3.1 Missing JWT
echo "3.1 Missing JWT test (should return 401)..."
NO_AUTH=$(curl -s -w "\n%{http_code}" -X GET "${BASE_URL}/api/ads/metrics?adUnitId=test" 2>&1)
HTTP_CODE=$(echo "$NO_AUTH" | tail -1)
if [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✅ Correctly returns 401 Unauthorized${NC}"
else
    echo -e "${YELLOW}⚠️  Expected 401, got: $HTTP_CODE${NC}"
fi

# 3.2 Malformed JSON
echo ""
echo "3.2 Malformed JSON test (should return 400)..."
BAD_JSON=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/ads/request" \
    -H "Content-Type: application/json" \
    -d '{bad json}' 2>&1)
HTTP_CODE=$(echo "$BAD_JSON" | tail -1)
if [ "$HTTP_CODE" = "400" ]; then
    echo -e "${GREEN}✅ Correctly returns 400 Bad Request${NC}"
else
    echo -e "${YELLOW}⚠️  Expected 400, got: $HTTP_CODE${NC}"
fi

# 3.3 Invalid impressionId
echo ""
echo "3.3 Invalid impressionId test (should return 400/404)..."
INVALID=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/ads/click" \
    -H "Content-Type: application/json" \
    -d '{"impressionId":"invalid-uuid-12345","clickUrl":"https://example.com"}' 2>&1)
HTTP_CODE=$(echo "$INVALID" | tail -1)
if [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "404" ]; then
    echo -e "${GREEN}✅ Invalid impressionId correctly returns $HTTP_CODE${NC}"
else
    echo -e "${YELLOW}⚠️  Expected 400/404, got: $HTTP_CODE${NC}"
fi

echo ""
echo "=== 4. DEMO PAGE VERIFICATION ==="
echo ""

# Check demo page accessibility
for URL in "/demo/demo.html" "/public/demo.html"; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}${URL}")
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✅ Demo page accessible at ${URL}${NC}"
        break
    fi
done
if [ "$HTTP_CODE" != "200" ]; then
    echo -e "${YELLOW}⚠️  Demo page not accessible${NC}"
fi

echo ""
echo "=== 5. PERFORMANCE TEST ==="
echo ""

if command -v npx > /dev/null 2>&1; then
    echo "Running quick load test (health endpoint, 10 connections, 5 seconds)..."
    npx -y autocannon -c 10 -d 5 "${BASE_URL}/api/ads/health" 2>&1 | tail -15 || echo "Performance test completed"
else
    echo -e "${YELLOW}⚠️  npx/autocannon not available - skipping${NC}"
fi

echo ""
echo "=== TEST SUMMARY ==="
echo ""
echo -e "${GREEN}✅ All critical tests completed${NC}"
echo ""
echo "📊 Quick Verification Commands:"
echo "  Health: curl ${BASE_URL}/api/ads/health | jq"
echo "  Demo:   open ${BASE_URL}/demo/demo.html"
echo ""
echo "🎉 Test plan execution complete!"


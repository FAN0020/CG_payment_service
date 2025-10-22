#!/bin/bash

# Payment Service Concurrency & Idempotency Test Runner
# This script provides easy commands to run the automated tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
API_BASE_URL="http://localhost:8790"
TEST_JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXItY29uY3VycmVudCIsImlzcyI6Im1haW5saW5lIiwiaWF0IjoxNzAzMTIzNDAwLCJleHAiOjE3MDMxMjM0NjAsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSJ9.test-signature"
PRODUCT_ID="classguru-pro"
TIMEOUT_MS="60000"
CONCURRENT_COUNT="3"

# Function to show help
show_help() {
    echo -e "${BLUE}🧪 Payment Service Concurrency & Idempotency Test Runner${NC}"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  test                    Run all concurrency and idempotency tests"
    echo "  concurrent              Run only concurrent payment test"
    echo "  timeout                 Run only timeout window test"
    echo "  idempotency             Run only idempotency key test"
    echo "  quick                   Run quick test with shorter timeout (30s)"
    echo "  help                    Show this help message"
    echo ""
    echo "Options:"
    echo "  --api-url <url>         API base URL (default: $API_BASE_URL)"
    echo "  --jwt <token>           JWT token for testing"
    echo "  --product-id <id>       Product ID to test (default: $PRODUCT_ID)"
    echo "  --timeout <ms>          Payment timeout in milliseconds (default: $TIMEOUT_MS)"
    echo "  --concurrent <count>    Number of concurrent requests (default: $CONCURRENT_COUNT)"
    echo ""
    echo "Environment Variables:"
    echo "  API_BASE_URL           Override API base URL"
    echo "  TEST_JWT               Override JWT token"
    echo "  PAYMENT_TIMEOUT_MS     Override payment timeout"
    echo ""
    echo "Examples:"
    echo "  $0 test                                    # Run all tests"
    echo "  $0 concurrent                              # Run concurrent test only"
    echo "  $0 quick                                   # Run quick test (30s timeout)"
    echo "  $0 test --api-url http://localhost:3000   # Test different API URL"
    echo "  $0 test --timeout 30000                   # Test with 30s timeout"
    echo ""
    echo "Test Cases:"
    echo "  1. Concurrent Payment Test - Multiple simultaneous requests with same JWT"
    echo "  2. Timeout Window Test - New session only after timeout expires"
    echo "  3. Idempotency Key Test - Same JWT + product = same idempotency key"
    echo ""
    echo "Expected Results:"
    echo "  ✅ Same Stripe session ID for concurrent requests"
    echo "  ✅ HTTP 409 'Payment already in progress' for duplicates"
    echo "  ✅ New session created only after timeout expires"
    echo "  ✅ Consistent idempotency key generation"
}

# Function to check if payment service is running
check_service() {
    echo -e "${BLUE}🔍 Checking if payment service is running...${NC}"
    
    if curl -s --connect-timeout 5 "$API_BASE_URL/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Payment service is running at $API_BASE_URL${NC}"
        return 0
    else
        echo -e "${RED}❌ Payment service is not running at $API_BASE_URL${NC}"
        echo -e "${YELLOW}💡 Start the service with: ./start-server.sh${NC}"
        return 1
    fi
}

# Function to run the test script
run_test() {
    local test_args="$1"
    local description="$2"
    
    echo -e "${BLUE}🚀 $description${NC}"
    echo -e "${BLUE}API Base URL: $API_BASE_URL${NC}"
    echo -e "${BLUE}Product ID: $PRODUCT_ID${NC}"
    echo -e "${BLUE}Timeout: ${TIMEOUT_MS}ms${NC}"
    echo ""
    
    # Set environment variables
    export API_BASE_URL
    export TEST_JWT
    export PAYMENT_TIMEOUT_MS="$TIMEOUT_MS"
    
    # Run the test
    node scripts/test-concurrent-checkout.js $test_args
}

# Parse command line arguments
COMMAND=""
while [[ $# -gt 0 ]]; do
    case $1 in
        test|concurrent|timeout|idempotency|quick|help)
            COMMAND="$1"
            shift
            ;;
        --api-url)
            API_BASE_URL="$2"
            shift 2
            ;;
        --jwt)
            TEST_JWT="$2"
            shift 2
            ;;
        --product-id)
            PRODUCT_ID="$2"
            shift 2
            ;;
        --timeout)
            TIMEOUT_MS="$2"
            shift 2
            ;;
        --concurrent)
            CONCURRENT_COUNT="$2"
            shift 2
            ;;
        *)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# Handle commands
case $COMMAND in
    help|"")
        show_help
        exit 0
        ;;
    test)
        if ! check_service; then
            exit 1
        fi
        run_test "" "Running All Concurrency & Idempotency Tests"
        ;;
    concurrent)
        if ! check_service; then
            exit 1
        fi
        run_test "--concurrent $CONCURRENT_COUNT" "Running Concurrent Payment Test Only"
        ;;
    timeout)
        if ! check_service; then
            exit 1
        fi
        run_test "--timeout $TIMEOUT_MS" "Running Timeout Window Test Only"
        ;;
    idempotency)
        if ! check_service; then
            exit 1
        fi
        run_test "" "Running Idempotency Key Test Only"
        ;;
    quick)
        if ! check_service; then
            exit 1
        fi
        TIMEOUT_MS="30000"  # 30 seconds for quick test
        run_test "--timeout $TIMEOUT_MS" "Running Quick Test (30s timeout)"
        ;;
    *)
        echo -e "${RED}❌ Unknown command: $COMMAND${NC}"
        show_help
        exit 1
        ;;
esac

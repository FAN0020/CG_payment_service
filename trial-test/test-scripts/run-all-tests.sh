#!/bin/bash
##
# Master Test Runner for ClassGuru Payment Service
# Runs all tests in sequence and generates summary report
##

set -e

echo ""
echo "================================================================================"
echo "  ClassGuru Payment Service - Complete Test Suite"
echo "================================================================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Change to test scripts directory
cd "$(dirname "$0")"
BASE_DIR="$(pwd)"

# Track results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run a test
run_test() {
  local test_name="$1"
  local test_script="$2"
  
  echo ""
  echo "--------------------------------------------------------------------------------"
  echo "Running: $test_name"
  echo "--------------------------------------------------------------------------------"
  
  if node "$test_script"; then
    echo -e "${GREEN}✅ $test_name PASSED${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    return 0
  else
    echo -e "${RED}❌ $test_name FAILED${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    return 1
  fi
}

# Test 1: Database
run_test "Test 1: Database Operations" "1-test-database.js" || true
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Test 2: JWT
run_test "Test 2: JWT Generation and Verification" "2-test-jwt.js" || true
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Test 3: Server (this starts the server)
run_test "Test 3: Server Startup and Health" "3-test-server.js" || true
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Wait for server to stabilize
echo ""
echo "⏳ Waiting 3 seconds for server to stabilize..."
sleep 3

# Test 4: API Routes
run_test "Test 4: API Routes" "4-test-api-routes.js" || true
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Test 5: Frontend
run_test "Test 5: Frontend Pages" "5-test-frontend.js" || true
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Generate Summary Report
echo ""
echo "================================================================================"
echo "  Test Summary"
echo "================================================================================"
echo ""
echo "Total Test Suites: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
echo ""

# Create summary JSON
cat > ../test-results/summary.json <<EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "totalTests": $TOTAL_TESTS,
  "passed": $PASSED_TESTS,
  "failed": $FAILED_TESTS,
  "success": $([ $FAILED_TESTS -eq 0 ] && echo "true" || echo "false")
}
EOF

if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "${GREEN}✅ ALL TESTS PASSED!${NC}"
  echo ""
  echo "🎉 Payment service is working correctly!"
  echo ""
  echo "Next steps:"
  echo "  1. Open http://localhost:8790/payment in your browser"
  echo "  2. Test the payment flow manually"
  echo "  3. Check test results in trial-test/test-results/"
  echo ""
  exit 0
else
  echo -e "${RED}❌ SOME TESTS FAILED${NC}"
  echo ""
  echo "Check test results in trial-test/test-results/ for details"
  echo ""
  exit 1
fi


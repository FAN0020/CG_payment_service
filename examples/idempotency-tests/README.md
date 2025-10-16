# Idempotency Tests for Payment Service

This test suite validates the idempotency mechanism of the payment service without requiring real Stripe API keys.

## What's Being Tested

The tests verify that the payment service correctly handles:

1. **Single Requests** - Normal subscription creation works correctly
2. **Duplicate Requests** - Same idempotency key returns cached result instead of creating duplicates
3. **Concurrent Requests** - Multiple simultaneous requests with the same idempotency key are handled safely without race conditions
4. **Different Keys** - Different idempotency keys create different orders as expected

## Test Architecture

### Mock Stripe Implementation

The tests use a **mock Stripe implementation** that's built directly into the service code (`src/lib/stripe.ts`). When the service detects a Stripe API key containing `_mock_`, it automatically switches to mock mode.

**Mock Features:**
- Simulates Stripe checkout session creation
- Simulates customer creation
- Returns mock IDs in the correct format
- No network calls to Stripe API
- Detailed console logging for debugging

### Test Runner

The test runner (`test-runner.js`) performs HTTP requests directly to the payment service API and validates responses.

**Test Flow:**
1. Check service health
2. Run 4 independent test scenarios
3. Report detailed results with color-coded output
4. Return appropriate exit code (0 = all passed, 1 = failures)

## Running the Tests

### Quick Start

```bash
cd /Users/fanyupei/Codes/ClassGuruAI/CG_payment_service/examples/idempotency-tests
./run-tests.sh
```

The script will:
1. Stop any existing payment service instances
2. Start the service with mock Stripe configuration
3. Wait for the service to be ready
4. Execute all tests
5. Display results
6. Clean up and stop the service

### Manual Testing

If you want to run the service and tests separately:

#### Terminal 1: Start the Service
```bash
cd /Users/fanyupei/Codes/ClassGuruAI/CG_payment_service

export STRIPE_SECRET_KEY="sk_test_mock_12345678901234567890123456789012"
export STRIPE_MONTHLY_PRICE_ID="price_mock_monthly"
export STRIPE_WEBHOOK_SECRET="whsec_test_mock_12345678901234567890123"
export JWT_SECRET="demo_jwt_secret_at_least_32_characters_long_for_classguru_payment_service"

npm run dev
```

#### Terminal 2: Run Tests
```bash
cd /Users/fanyupei/Codes/ClassGuruAI/CG_payment_service/examples/idempotency-tests
node test-runner.js
```

## Test Output

### Successful Run
```
[INFO] Checking if payment service is running...
[✓ SUCCESS] Payment service is running

[TEST] Test 1: Single request should succeed
[  →] Idempotency key: single-1760643641338
[✓ SUCCESS] Single request succeeded
[  →] Created order: order_w18EkO3zxLzcJJ3n

[TEST] Test 2: Duplicate requests should return same response
[✓ SUCCESS] Idempotency working: both requests returned same order

[TEST] Test 3: Concurrent requests should handle race conditions
[✓ SUCCESS] Concurrent requests handled correctly: all got same order

[TEST] Test 4: Different idempotency keys should create different subscriptions
[✓ SUCCESS] Different keys created different orders

[✓ SUCCESS] All 4 tests passed! 🎉
```

### Color Legend
- 🔵 **Blue [INFO]** - Informational messages
- 🟢 **Green [✓ SUCCESS]** - Test passed
- 🔴 **Red [✗ ERROR]** - Test failed
- 🔵 **Cyan [TEST]** - Test case starting
- ⚪ **Gray [→]** - Detail/debug information

## Files in This Directory

```
examples/idempotency-tests/
├── README.md                     # This file
├── run-tests.sh                  # Main test execution script
├── test-runner.js                # Test suite implementation
├── package.json                  # Dependencies (jsonwebtoken)
├── mock-stripe.js                # Mock Stripe implementation (legacy)
├── stripe-mock-loader.js         # Module loader (legacy)
└── patch-stripe-for-test.js      # Alternative mock approach (legacy)
```

## How It Works

### Idempotency Mechanism

The payment service implements idempotency using:

1. **Idempotency Key**: Client provides `idempotency_key` in request
2. **Database Storage**: Key is stored with `user_id` and `order_id`
3. **Duplicate Detection**: Before creating order, checks if key already exists
4. **Cached Response**: Returns existing order info for duplicate requests
5. **TTL**: Idempotency records expire after 24 hours

### Key Code Components

**Database (`src/lib/database.ts`):**
- `recordIdempotency()` - Stores idempotency key
- `getIdempotentOrder()` - Retrieves existing order by key
- Creates index on `(idempotency_key, user_id)` for fast lookups

**API Route (`src/routes/payment.ts`):**
```javascript
// Check for duplicate request
const existingOrderId = db.getIdempotentOrder(idempotency_key, userId)
if (existingOrderId) {
  // Return cached response
  return existingOrder
}

// Create new order
const orderResult = await createOrder(...)

// Record idempotency
db.recordIdempotency(idempotency_key, userId, orderId, 24)
```

**Mock Stripe (`src/lib/stripe.ts`):**
```javascript
constructor(secretKey: string) {
  // Detect mock mode
  this.testMode = secretKey.includes('_mock_')
  
  if (this.testMode) {
    this.stripe = this.createMockStripe()
  } else {
    this.stripe = new Stripe(secretKey, { ... })
  }
}
```

## Troubleshooting

### Service Won't Start

**Check logs:**
```bash
tail -50 /tmp/payment-service.log
```

**Common issues:**
- Port 8790 already in use: `lsof -i :8790` and kill the process
- Missing environment variables: Ensure all required vars are set
- TypeScript compilation errors: Check `src/lib/stripe.ts` for syntax errors

### Tests Fail

**Enable debug output:**
Edit `test-runner.js` and check the detailed response logs under `[  →]` lines.

**Common issues:**
- Service not in mock mode: Check logs for `[STRIPE-MANAGER] Running in MOCK TEST MODE`
- Wrong API response format: Update assertions in `test-runner.js`
- Race conditions: The concurrent test may occasionally fail - this indicates a real bug!

### Health Check Fails

**Verify service is running:**
```bash
curl -v http://127.0.0.1:8790/api/payment/health
```

**Check IPv4 vs IPv6:**
The test runner uses `127.0.0.1` (IPv4) explicitly. If your system prefers IPv6, the service might bind to `::1` instead.

## Extending the Tests

### Adding New Test Cases

Edit `test-runner.js` and add a new async function:

```javascript
async function testMyNewScenario() {
  logTest('Test X: My new scenario');
  
  const token = generateToken();
  const response = await makeRequest('/api/payment/create-subscription', {
    jwt: token,
    idempotency_key: `test-${Date.now()}`,
    product_id: 'trial-plan',
    currency: 'USD',
    customer_email: 'test@example.com'
  });
  
  // Your assertions here
  if (response.status === 200) {
    logSuccess('Test passed');
    return true;
  } else {
    logError('Test failed');
    return false;
  }
}
```

Then add it to the `runTests()` function:

```javascript
results.push(await testMyNewScenario());
```

### Testing Other Endpoints

The `makeRequest()` function can call any endpoint:

```javascript
// For GET requests
const response = await makeRequest('/api/payment/health', {}, 'GET');

// For POST requests (default)
const response = await makeRequest('/api/payment/webhook', webhookData);
```

## Notes

- Tests use an in-memory SQLite database (resets between runs)
- JWT tokens are signed with the same secret as the service
- Mock Stripe always succeeds - no error simulation currently
- Idempotency TTL is 24 hours in the actual service
- Tests execute sequentially to avoid interference

## Success Criteria

✅ All 4 tests passing consistently  
✅ No duplicate orders created for same idempotency key  
✅ Concurrent requests handled safely (no race conditions)  
✅ Different idempotency keys create separate orders  
✅ Service runs without real Stripe API keys


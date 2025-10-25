# Payment Service Concurrency & Idempotency Refinement

This document describes the refined concurrency control and idempotency handling implemented for the payment service microservice.

## 🎯 Objectives Achieved

### 1. ✅ JWT-Based Idempotency Key Generation
- **Implementation**: `src/utils/hash.ts` with SHA-256 hashing
- **Formula**: `sha256(userId:productId:bucket)` where `bucket = Math.floor(Date.now() / 60000)`
- **Purpose**: Same user + product within 1 minute → same key → reused Stripe session
- **Configurable**: Bucket size adjusts based on `PAYMENT_TIMEOUT_MS` environment variable

### 2. ✅ Timeout-Window Enforcement
- **Database Table**: `active_payments` stores `(userId, productId, idempotencyKey, sessionUrl, createdAt, expiresAt)`
- **Logic**: Before creating checkout, check for active payment within timeout window
- **Response**: Returns 409 with existing session URL or retry time
- **Cleanup**: Webhook handlers remove active payments on successful completion

### 3. ✅ Enhanced Logging
- **Format**: `[payment-service] uid=<userId> product=<productId> key=<idempotencyKey> session=<sessionId>`
- **Purpose**: Easy verification that same key leads to same session
- **Coverage**: Idempotency key usage, session creation, success verification, conflict detection

### 4. ✅ Frontend 409 Handling
- **Behavior**: Shows "Payment in progress, please wait" message
- **Smart Redirect**: If session URL provided, redirects to existing checkout
- **Retry Logic**: Re-enables button after retry period

### 5. ✅ Comprehensive Testing
- **Script**: `scripts/test-concurrent-checkout.js`
- **Tests**: Concurrent requests, session reuse, conflict handling
- **Verification**: Same JWT → same session ID, proper 409 responses

## 🏗️ Implementation Details

### Database Schema Changes

```sql
-- New active_payments table for timeout-window enforcement
CREATE TABLE IF NOT EXISTS active_payments (
  user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  session_url TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_active_payments_expires ON active_payments(expires_at);
CREATE INDEX IF NOT EXISTS idx_active_payments_user_product ON active_payments(user_id, product_id);
```

### API Flow

1. **Request Received**: JWT verified, product validated
2. **Idempotency Key Generated**: `sha256(userId:productId:bucket)`
3. **Timeout Check**: Look for active payment within timeout window
4. **Idempotency Check**: Check if request already processed
5. **Concurrency Lock**: Acquire lightweight lock
6. **Stripe Session**: Create with idempotency key
7. **Active Payment Record**: Store for timeout enforcement
8. **Response**: Return checkout URL or 409 conflict

### Error Handling

**409 Conflict Response:**
```json
{
  "status_code": 409,
  "message": "Payment already in progress.",
  "request_id": "req_123",
  "data": {
    "idempotency_key": "key_123",
    "session_url": "https://checkout.stripe.com/pay/cs_...",
    "retry_after": 45
  }
}
```

### Environment Configuration

```env
# Payment timeout window (default: 60 seconds)
PAYMENT_TIMEOUT_MS=60000

# JWT secret (must match mainline)
JWT_SECRET=your_shared_secret_at_least_32_characters

# Stripe configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## 🧪 Testing

### Running Tests

```bash
# Basic concurrent test
node scripts/test-concurrent-checkout.js

# With custom API URL
API_BASE_URL=http://localhost:8790 node scripts/test-concurrent-checkout.js

# With custom JWT
TEST_JWT="your-jwt-token" node scripts/test-concurrent-checkout.js
```

### Expected Results

**✅ Success Case:**
- 3 concurrent requests sent with same JWT
- 1 request succeeds (200) with new Stripe session
- 2 requests return 409 "Payment already in progress"
- All successful requests return identical session ID and order ID

**❌ Failure Case:**
- Multiple requests return different session IDs
- Multiple orders created for same user/product
- No 409 conflicts returned

### Test Output Example

```
🧪 Testing Concurrent Payment Prevention
==========================================
API Base URL: http://localhost:8790
Test JWT: eyJhbGciOiJIUzI1NiIsInR5cCI6...

🚀 Starting concurrent checkout test...

[Request 1] Sending checkout request...
[Request 1] Response (245ms):
  Status: 200
  Message: Checkout session created successfully
  Order ID: order_abc123def456
  Session ID: cs_test_1234567890abcdef
  Checkout URL: Present

[Request 2] Sending checkout request...
[Request 2] Response (12ms):
  Status: 409
  Message: Payment already in progress.

[Request 3] Sending checkout request...
[Request 3] Response (8ms):
  Status: 409
  Message: Payment already in progress.

📊 Test Results Summary
======================
Total Requests: 3
Successful (200): 1
Conflicts (409): 2
Errors: 0

🔍 Idempotency Analysis:
Session IDs returned: cs_test_1234567890abcdef
Unique session IDs: 1
✅ SUCCESS: All requests returned the same Stripe session ID!
   Session ID: cs_test_1234567890abcdef

📋 Order Analysis:
Order IDs returned: order_abc123def456
Unique order IDs: 1
✅ SUCCESS: All requests returned the same order ID!

⚠️  Conflict Analysis:
Request 2: Payment already in progress.
Request 3: Payment already in progress.
✅ SUCCESS: Only one request succeeded, others returned 409 conflicts!

📈 Performance Analysis:
Request 1: 245ms
Request 2: 12ms
Request 3: 8ms
Average response time: 88.33ms

🏁 Test completed!
✅ Test passed - idempotency working correctly!
```

## 🔍 Key Features

### 1. Deterministic Idempotency Keys
- **JWT UID**: Extracted from JWT payload (`payload.sub`)
- **Product ID**: From request body (e.g., `monthly-plan`)
- **Time Bucket**: 1-minute windows (configurable)
- **Hash**: SHA-256 for consistent, secure keys

### 2. Multi-Layer Concurrency Control
- **Stripe Idempotency**: Native Stripe API idempotency
- **Database Idempotency**: Client request deduplication
- **Active Payment Tracking**: Timeout-window enforcement
- **Concurrency Locks**: Lightweight user/product locking

### 3. Graceful Conflict Resolution
- **409 Responses**: Clear conflict indication
- **Session Reuse**: Return existing checkout URL when available
- **Retry Guidance**: Provide retry timing information
- **Frontend Handling**: Smart redirect or retry logic

### 4. Comprehensive Cleanup
- **Webhook Integration**: Remove active payments on success
- **Lock Cleanup**: Release locks after completion
- **Expired Record Cleanup**: Automatic cleanup of old records
- **Error Recovery**: Cleanup on error conditions

## 📊 Monitoring & Debugging

### Key Log Messages

1. **Idempotency Key Generation:**
   ```
   [payment-service] idempotencyKey=<key> user=<id> product=<id>
   ```

2. **Session Creation:**
   ```
   [payment-service] idempotencyKey=<key> user=<id> product=<id> session=<session_id>
   ```

3. **Timeout Window Enforcement:**
   ```
   Active payment found within timeout window
   ```

4. **Success Verification:**
   ```
   [payment-service] Idempotency check passed: session created successfully
   ```

### Database Monitoring

```sql
-- Check active payments
SELECT * FROM active_payments WHERE expires_at > strftime('%s', 'now') * 1000;

-- Check concurrency locks
SELECT * FROM concurrency_locks WHERE expires_at > strftime('%s', 'now') * 1000;

-- Check idempotency records
SELECT * FROM client_idempotency WHERE expires_at > strftime('%s', 'now') * 1000;
```

## 🚀 Production Considerations

### Performance
- **Database Indexes**: Optimized for user/product lookups
- **Lock TTL**: Short-lived locks (10 seconds) prevent deadlocks
- **Cleanup Jobs**: Regular cleanup of expired records
- **Connection Pooling**: Efficient database connections

### Security
- **JWT Verification**: Proper signature validation
- **Idempotency Keys**: Cryptographically secure hashing
- **Timeout Windows**: Prevent replay attacks
- **Input Validation**: Strict request validation

### Reliability
- **Error Handling**: Graceful degradation on failures
- **Lock Cleanup**: Automatic cleanup on errors
- **Webhook Idempotency**: Prevent duplicate processing
- **Monitoring**: Comprehensive logging for debugging

## 🔧 Troubleshooting

### Common Issues

1. **Different Session IDs Returned**
   - Check if idempotency key is being passed to Stripe API
   - Verify JWT-based key generation is working
   - Check Stripe API logs for idempotency key usage

2. **No 409 Conflicts**
   - Verify timeout-window enforcement is active
   - Check `active_payments` table for records
   - Ensure webhook cleanup is working

3. **Multiple Orders Created**
   - Check database idempotency implementation
   - Verify order creation happens after idempotency check
   - Check for race conditions in order creation

### Debug Commands

```bash
# Check server logs
tail -f logs/payment-service.log | grep "idempotencyKey\|Active payment\|Conflict"

# Check database state
sqlite3 data/payment.db "SELECT * FROM active_payments WHERE expires_at > $(date +%s)000;"

# Test concurrent requests
node scripts/test-concurrent-checkout.js
```

## 📈 Expected Outcomes

After implementing these refinements:

- ✅ **Concurrent Prevention**: Two rapid payments with same JWT produce one active checkout session
- ✅ **Session Reuse**: Second request within timeout returns 409 with same session URL  
- ✅ **Timeout Enforcement**: New payment allowed only after timeout expires
- ✅ **Verified Logs**: Consistent idempotency behavior with detailed logging
- ✅ **Frontend Handling**: Graceful 409 response handling with user-friendly messages
- ✅ **Webhook Integration**: Proper cleanup of active payments and locks on successful completion

The payment service now has robust concurrency control that prevents duplicate charges while providing clear user feedback and comprehensive diagnostics for monitoring and debugging.

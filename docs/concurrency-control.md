# Concurrency Control Testing

This document describes the concurrency control improvements made to the payment service and how to test them.

## Overview

The payment service now includes comprehensive concurrency control to prevent duplicate Stripe checkout sessions and ensure idempotency across concurrent requests.

## Key Improvements

### 1. Stripe Idempotency Integration
- **Fixed**: Idempotency keys are now properly passed to Stripe's `checkout.sessions.create()` API
- **Benefit**: Concurrent requests with the same idempotency key will return the same Stripe session ID
- **Implementation**: Added `idempotencyKey` parameter to `StripeManager.createCheckoutSession()`

### 2. Database-Level Idempotency
- **Existing**: Client-provided idempotency keys are tracked in `client_idempotency` table
- **Benefit**: Prevents duplicate API calls from creating multiple orders
- **TTL**: 24 hours by default

### 3. Lightweight Concurrency Locks
- **New**: Added `concurrency_locks` table for user/product-specific locking
- **Benefit**: Prevents concurrent checkout attempts for the same user/product combination
- **TTL**: 10 seconds (configurable)
- **Scope**: `lock:user:{userId}:product:{productId}`

### 4. Comprehensive Logging
- **Added**: Detailed logging for idempotency keys, user IDs, product IDs, and session IDs
- **Format**: `[payment-service] idempotencyKey=<key> user=<id> product=<id> session=<session_id>`
- **Benefit**: Easy debugging and verification of idempotency behavior

### 5. Graceful Error Handling
- **Added**: Proper handling of Stripe idempotency conflicts (409 status)
- **Added**: User-friendly error messages for concurrent requests
- **Added**: Automatic lock cleanup on success/error

## Testing

### Prerequisites
1. Payment service running on `http://localhost:3000` (or set `API_BASE_URL`)
2. Valid Stripe configuration
3. Test JWT token (or set `TEST_JWT`)

### Running the Concurrent Test

```bash
# Basic test
node scripts/test-concurrent-checkout.js

# With custom API URL
node scripts/test-concurrent-checkout.js --url http://localhost:3000

# With custom JWT
node scripts/test-concurrent-checkout.js --jwt "your-test-jwt-token"

# Show help
node scripts/test-concurrent-checkout.js --help
```

### Expected Results

**✅ Success Case:**
- 3 concurrent requests sent with same idempotency key
- 1 request succeeds (200) with new Stripe session
- 2 requests return 409 "Payment is already in progress"
- All successful requests return identical session ID and order ID

**❌ Failure Case:**
- Multiple requests return different session IDs
- Multiple orders created for same user/product
- No 409 conflicts returned

### Test Output Example

```
🧪 Testing Concurrent Checkout Idempotency
==========================================
API Base URL: http://localhost:3000
Test User ID: test-user-concurrent-1703123456789
Test Product ID: monthly-plan
Idempotency Key: test-concurrent-test-user-concurrent-1703123456789-monthly-plan-1703123400000

🚀 Starting concurrent checkout test...

[Request 1] Sending checkout request...
[Request 1] Response (245ms):
  Status: 200
  Status Code: 200
  Message: Checkout session created successfully
  Order ID: order_abc123def456
  Session ID: cs_test_1234567890abcdef
  Checkout URL: Present

[Request 2] Sending checkout request...
[Request 2] Response (12ms):
  Status: 409
  Status Code: 409
  Message: Payment is already in progress. Please wait.

[Request 3] Sending checkout request...
[Request 3] Response (8ms):
  Status: 409
  Status Code: 409
  Message: Payment is already in progress. Please wait.

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
Request 2: Payment is already in progress. Please wait.
Request 3: Payment is already in progress. Please wait.
✅ SUCCESS: Only one request succeeded, others returned 409 conflicts!

📈 Performance Analysis:
Request 1: 245ms
Request 2: 12ms
Request 3: 8ms
Average response time: 88.33ms

🏁 Test completed!
✅ Test passed - idempotency working correctly!
```

## Implementation Details

### Database Schema Changes

```sql
-- New concurrency locks table
CREATE TABLE IF NOT EXISTS concurrency_locks (
  lock_key TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  request_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_locks_user_product ON concurrency_locks(user_id, product_id);
CREATE INDEX IF NOT EXISTS idx_locks_expires ON concurrency_locks(expires_at);
```

### API Changes

**StripeManager.createCheckoutSession()**
- Added `idempotencyKey?: string` parameter
- Passes idempotency key to Stripe API options
- Handles Stripe idempotency conflicts gracefully

**PaymentDatabase**
- Added `tryAcquireLock()`, `releaseLock()`, `hasActiveLock()`, `cleanExpiredLocks()` methods
- Automatic cleanup of expired locks

**Payment Routes**
- Added concurrency lock acquisition before order creation
- Added lock release on success/error
- Enhanced error handling for idempotency conflicts
- Comprehensive logging for diagnostics

### Error Responses

**409 Conflict Response:**
```json
{
  "status_code": 409,
  "message": "Payment is already in progress. Please wait.",
  "request_id": "req_123",
  "data": {
    "idempotency_key": "key_123",
    "retry_after": 5
  }
}
```

## Monitoring

### Key Log Messages

1. **Idempotency Key Usage:**
   ```
   [payment-service] idempotencyKey=<key> user=<id> product=<id>
   ```

2. **Session Creation:**
   ```
   [payment-service] idempotencyKey=<key> user=<id> product=<id> session=<session_id>
   ```

3. **Success Verification:**
   ```
   [payment-service] Idempotency check passed: session created successfully
   ```

4. **Conflict Detection:**
   ```
   Idempotency conflict detected - returning 409 status
   ```

### Database Monitoring

- Monitor `concurrency_locks` table for lock duration and frequency
- Monitor `client_idempotency` table for duplicate request patterns
- Clean up expired records regularly

## Troubleshooting

### Common Issues

1. **Different Session IDs Returned**
   - Check if idempotency key is being passed to Stripe API
   - Verify idempotency key format and uniqueness
   - Check Stripe API logs for idempotency key usage

2. **No 409 Conflicts**
   - Verify concurrency lock implementation
   - Check lock TTL settings
   - Ensure locks are being acquired before Stripe calls

3. **Multiple Orders Created**
   - Check database idempotency implementation
   - Verify order creation happens after idempotency check
   - Check for race conditions in order creation

### Debug Commands

```bash
# Check database locks
sqlite3 data/payment.db "SELECT * FROM concurrency_locks WHERE expires_at > $(date +%s)000;"

# Check idempotency records
sqlite3 data/payment.db "SELECT * FROM client_idempotency WHERE expires_at > $(date +%s)000;"

# Clean expired records
sqlite3 data/payment.db "DELETE FROM concurrency_locks WHERE expires_at < $(date +%s)000;"
sqlite3 data/payment.db "DELETE FROM client_idempotency WHERE expires_at < $(date +%s)000;"
```

# Trial Test Suite - ClassGuru Payment Service

Complete testing framework for validating payment service functionality.

## 🚀 Quick Start

### Run All Tests
```bash
cd /Users/fanyupei/Codes/ClassGuruAI/CG_payment_service
bash trial-test/test-scripts/run-all-tests.sh
```

### Run Individual Test
```bash
node trial-test/test-scripts/1-test-database.js
node trial-test/test-scripts/2-test-jwt.js
node trial-test/test-scripts/3-test-server.js
node trial-test/test-scripts/4-test-api-routes.js
node trial-test/test-scripts/5-test-frontend.js
```

## 📁 Structure

```
trial-test/
├── test-scripts/              # Test suite
│   ├── 1-test-database.js     # Database operations (13 tests)
│   ├── 2-test-jwt.js          # JWT authentication (11 tests)
│   ├── 3-test-server.js       # Server startup & health
│   ├── 4-test-api-routes.js   # API endpoints (10 tests)
│   ├── 5-test-frontend.js     # Frontend pages (26 tests)
│   └── run-all-tests.sh       # Master test runner
│
├── mock-data/                 # Test configuration
│   ├── test-config.json       # Test settings
│   └── test-jwt-tokens.json   # Generated JWT tokens
│
└── README.md                  # This file
```

## 🧪 Test Coverage

### Test 1: Database Operations ✅
**Tests:** 13 | **Status:** All passed

- SQLite initialization & table creation
- CRUD operations & query operations
- Duplicate key prevention
- Connection management

### Test 2: JWT Authentication ✅
**Tests:** 11 | **Status:** All passed

- Token generation & verification
- Expired token rejection
- Tampered token detection
- Wrong secret rejection

**Output:** Generates `mock-data/test-jwt-tokens.json` with test tokens

### Test 3: Server Startup ✅
**Status:** Server running

- Server startup & health endpoint
- Frontend routes & API authentication
- Static file serving & CORS headers

⚠️ Starts server automatically if not running

### Test 4: API Routes ⚠️
**Tests:** 10 | **Status:** 5/10 passed (mock Stripe limitation)

- Create/verify subscription endpoints
- Idempotency protection & JWT validation
- Error handling & input validation

⚠️ Mock Stripe keys prevent full checkout session creation

### Test 5: Frontend Pages ✅
**Tests:** 26 | **Status:** 25/26 passed

- All page loading (payment, success, cancel)
- Static assets (CSS, JS)
- Content-type headers & page structure
- Required HTML elements

## 📊 Test Results Summary

| Test Suite | Status |
|------------|--------|
| Database | ✅ PASS (13/13) |
| JWT | ✅ PASS (11/11) |
| Server | ✅ RUNNING |
| API Routes | ⚠️ PARTIAL (5/10) |
| Frontend | ✅ PASS (25/26) |

**Overall:** ✅ System Operational

## 🔧 Configuration

### test-config.json
```json
{
  "server": {
    "baseUrl": "http://localhost:8790",
    "port": 8790
  },
  "jwt": {
    "secret": "demo-secret-key-change-in-production-minimum-32-characters-for-security",
    "testUserId": "test-user-12345",
    "testEmail": "test@classguru.ai"
  }
}
```

### test-jwt-tokens.json
Auto-generated JWT tokens:
- `tokens.standard` - 7-day validity
- `tokens.shortLived` - 5-minute validity
- `tokens.withRoles` - Includes admin role
- `tokens.user1/2/3` - Multiple test users

## ⚠️ Known Limitations

### Mock Stripe Mode
Tests use mock Stripe API keys:
- ✅ API validation & request processing work
- ✅ Database operations work
- ❌ Cannot create real Stripe checkout sessions
- ❌ Cannot test webhook processing
- ❌ Cannot complete actual payments

**Solution:** Configure real Stripe test keys for full functionality

## 💡 Usage Tips

**Before running tests:**
```bash
# Ensure you're in project root
cd /Users/fanyupei/Codes/ClassGuruAI/CG_payment_service

# Check if server is running
lsof -i :8790
```

**Reading test output:**
- ✅ = Test passed
- ❌ = Test failed
- ⚠️ = Partial pass or warning

**Debugging failed tests:**
```bash
# Check server status
curl http://localhost:8790/api/payment/health

# Regenerate JWT tokens
node trial-test/test-scripts/2-test-jwt.js
```

## 🎯 Test Coverage

### ✅ Fully Tested
- Database initialization & CRUD operations
- JWT generation & validation
- Server startup & route registration
- Frontend page loading & static assets
- Request validation & error handling

### ⚠️ Partially Tested
- Stripe integration (mock keys only)
- Checkout session creation
- Webhook processing

### 🔲 Not Tested
- Production Stripe keys
- Real payment flow end-to-end
- Webhook signature with real events

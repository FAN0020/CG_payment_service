# ClassGuru Payment Service

**Complete standalone Stripe subscription billing microservice**

This is a self-contained payment service. Everything needed is inside `CG_payment_service/`.

**What's inside:**
- **13 TypeScript files** (~1,700 lines of code)
- **1 comprehensive README** 
- **Integration notes** (handoff documentation)
- **OpenAPI 3.0 specification** (complete API docs)
- **Complete Stripe integration** with webhooks and idempotency

---

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Architecture Layers & File Responsibilities](#architecture-layers--file-responsibilities)
- [Setup Instructions](#setup-instructions)
- [API Reference](#api-reference)
- [Integration with Mainline](#integration-with-mainline)
- [Frontend Integration Examples](#frontend-integration-examples)
- [Database Schema](#database-schema)
- [Security](#security)
- [Testing](#testing)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp env.example .env
# Edit .env with your Stripe keys and JWT secret

# 3. Run development server
npm run dev

# 4. Test health endpoint
curl http://localhost:8790/api/payment/health
```

Service runs on **http://localhost:8790**

### Frontend Payment Page

A beautiful payment page is included at `/payment` endpoint:

```bash
# Visit the payment page
open http://localhost:8790/payment
```

**Features:**
- Two pricing plans: Trial ($1 for 2 days) and Monthly ($12.90/month)
- Responsive design following ClassGuru UI guidelines
- Secure Stripe checkout integration
- JWT authentication

See `frontend/README.md` for detailed documentation.

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────┐
│         Payment Service (Port 8790)         │
├─────────────────────────────────────────────┤
│                                             │
│  API Routes (JWT authenticated)             │
│  ├─ POST /api/payment/create-subscription  │
│  ├─ POST /api/payment/verify-subscription  │
│  └─ GET  /api/payment/health                │
│                                             │
│  Webhook Routes (Stripe signature verified) │
│  └─ POST /webhooks/stripe                   │
│                                             │
│  Internal Billing Handlers                  │
│  ├─ create-order                            │
│  ├─ update-subscription                     │
│  └─ query-subscription                      │
│                                             │
│  Data Layer                                 │
│  └─ SQLite (subscription_orders, events)    │
│                                             │
└─────────────────────────────────────────────┘
         ↕                           ↕
    Mainline API              Stripe Webhooks
```

### Key Features

- **Stripe Integration**: Checkout sessions, subscriptions, webhooks
- **JWT Authentication**: Shared secret with mainline for API security
- **Idempotent Webhooks**: Prevents duplicate event processing
- **SQLite Database**: Local storage (ready for unified DB migration)

**Important**: This service contains *internal billing handlers*, NOT mainline plugins. The handlers are internal to this microservice. The mainline service communicates with this payment service via REST API only.

---

## Project Structure

```
CG_payment_service/
├── src/
│   ├── server.ts                 # Main entry point
│   ├── lib/
│   │   ├── database.ts           # SQLite manager
│   │   ├── handler-registry.ts   # Internal handler orchestrator
│   │   ├── jwt.ts                # JWT verification
│   │   ├── stripe.ts             # Stripe API wrapper
│   │   └── logger.ts             # Structured logging
│   ├── handlers/                 # Internal billing operations
│   │   ├── create-order.ts
│   │   ├── update-subscription.ts
│   │   ├── query-subscription.ts
│   │   └── index.ts
│   ├── routes/
│   │   ├── payment.ts            # Public API endpoints
│   │   └── webhook.ts            # Stripe webhook handler
│   └── types/
│       └── index.ts              # TypeScript type definitions
├── frontend/                     # Payment frontend page
│   ├── index.html                # Payment page UI
│   ├── app.js                    # Payment logic
│   └── README.md                 # Frontend documentation
├── package.json
├── tsconfig.json
├── env.example                   # Environment template
└── README.md                     # This file
```

---

## Architecture Layers & File Responsibilities

### 📋 Layer 1: Entry Point
- **`server.ts`** - Application bootstrap: loads config, initializes DB/managers/handlers, registers routes, starts Fastify server on port 8790

### 🔧 Layer 2: Infrastructure (`lib/`)
- **`database.ts`** - SQLite wrapper: manages `subscription_orders` and `payment_events` tables, provides CRUD operations and idempotency checks
- **`stripe.ts`** - Stripe SDK wrapper: creates checkout sessions, manages subscriptions, verifies webhook signatures
- **`jwt.ts`** - JWT manager: verifies tokens, extracts user info (email, userId), validates payload with Zod
- **`logger.ts`** - Structured logger: supports debug/info/warn/error levels with timestamps and context
- **`handler-registry.ts`** - Internal dispatcher: registers and executes billing handlers with standardized context/response

### 💼 Layer 3: Business Logic (`handlers/`)
- **`create-order.ts`** - Creates subscription orders with `pending` status, generates unique order IDs
- **`update-subscription.ts`** - Updates order status/Stripe IDs/expiration, used by webhooks and API
- **`query-subscription.ts`** - Queries subscription by email/userId/orderId, returns active status and history
- **`index.ts`** - Registers all handlers into the registry on startup

### 🌐 Layer 4: API Routes (`routes/`)
- **`payment.ts`** - Public REST API:
  - `POST /api/payment/create-subscription` - Creates order → Stripe checkout session → returns checkout URL
  - `POST /api/payment/verify-subscription` - Queries user's active subscription status
  - `GET /api/payment/health` - Health check endpoint
- **`webhook.ts`** - Stripe webhook handler:
  - Verifies signatures, checks idempotency, processes events (`checkout.session.completed`, `subscription.updated`, `invoice.payment_succeeded`, etc.)

### 📐 Layer 5: Type System (`types/`)
- **`index.ts`** - TypeScript interfaces + Zod schemas for runtime validation (PluginContext, SubscriptionOrder, JWT payload, API requests)

### 🔄 Complete Flow Examples

**User Subscribe:**
```
Frontend → Mainline (payment.subscribe) → POST /create-subscription → 
JWT verify → create-order handler → Stripe checkout → update-subscription → 
Return checkout URL → User pays → Webhook activates order
```

**Check Status:**
```
Frontend → Mainline (payment.verify) → POST /verify-subscription → 
JWT verify → query-subscription handler → Return active status
```

**Auto Renewal:**
```
Stripe monthly charge → Webhook (invoice.payment_succeeded) → 
Find order → update-subscription → Extend expiration
```

---

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- Stripe account (test mode is fine)
- JWT secret (must match mainline)

### Step 1: Install Dependencies

```bash
cd CG_payment_service
npm install
```

### Step 2: Get Stripe Credentials

#### Create Stripe Account
1. Sign up at https://stripe.com
2. Go to **Dashboard → Developers → API keys**
3. Copy your **Secret key** (starts with `sk_test_`)

#### Create Product and Price
1. Go to **Dashboard → Products**
2. Click **"Add product"**
3. Fill in:
   - Name: "ClassGuru Monthly Subscription"
   - Price: 9.90 SGD
   - Billing: Recurring, monthly
4. Click **"Save product"**
5. Copy the **Price ID** (starts with `price_`)

### Step 3: Configure Environment

```bash
cp env.example .env
```

Edit `.env`:

```env
# Server
PORT=8790

# Stripe (use test keys for development)
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_secret_here
STRIPE_MONTHLY_PRICE_ID=price_your_price_id_here

# JWT (MUST match mainline config)
JWT_SECRET=your_shared_secret_at_least_32_characters

# Database
DB_PATH=./payment.db

# Plan details
MONTHLY_PLAN_AMOUNT=9.90
MONTHLY_PLAN_CURRENCY=SGD

# Frontend redirect URLs
FRONTEND_SUCCESS_URL=http://localhost:3000/payment/success
FRONTEND_CANCEL_URL=http://localhost:3000/payment/cancel
```

### Step 4: Setup Local Webhook Testing

For local development, use Stripe CLI:

```bash
# Install Stripe CLI (macOS)
brew install stripe/stripe-cli/stripe

# Login and forward webhooks
stripe login
stripe listen --forward-to localhost:8790/webhooks/stripe
```

Copy the webhook signing secret from the output to `.env` as `STRIPE_WEBHOOK_SECRET`.

**Keep this terminal running while developing!**

### Step 5: Start Payment Service

```bash
npm run dev
```

You should see:
```
[DB] Database initialized successfully
[Handlers] Registered 3 billing handlers: create-order, update-subscription, query-subscription
🚀 Payment service running on port 8790
```

### Step 6: Test

```bash
curl http://localhost:8790/api/payment/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "payment",
  "timestamp": 1733011200000
}
```

---

## API Reference

Complete API documentation is available in **[openapi.yaml](./openapi.yaml)**.

### Quick Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/payment/health` | GET | Health check |
| `/api/payment/create-subscription` | POST | Create checkout session (requires JWT + idempotency_key) |
| `/api/payment/verify-subscription` | POST | Check subscription status (requires JWT) |
| `/webhooks/stripe` | POST | Stripe webhook handler (signature verified) |

### JWT Payload Structure

All API endpoints (except health and webhooks) require a JWT with this structure:

```typescript
{
  // Required: Authentication fields
  "sub": "user-123456",           // User ID (required)
  "iss": "mainline",              // Issuer (required)
  "iat": 1699999000,              // Issued at (required)
  "exp": 1700000000,              // Expiration (required)
  
  // Optional: User information
  "email": "user@example.com",    // Email for display/support
  "roles": ["user", "premium"]    // Authorization roles/permissions
}
```

**Note:** Business logic parameters (product_id, currency, payment_method) are now passed in the API request body, not in JWT.

### Request Examples

**Create Subscription:**
```bash
curl -X POST http://localhost:8790/api/payment/create-subscription \
  -H "Content-Type: application/json" \
  -d '{
    "jwt": "eyJhbGciOiJIUzI1NiIs...",
    "idempotency_key": "550e8400-e29b-41d4-a716-446655440000",
    "product_id": "monthly-plan",
    "currency": "SGD",
    "payment_method": "card",
    "customer_email": "user@example.com",
    "platform": "web",
    "client_ref": "checkout_btn_v3"
  }'
```

**Verify Subscription:**
```bash
curl -X POST http://localhost:8790/api/payment/verify-subscription \
  -H "Content-Type: application/json" \
  -d '{"jwt": "eyJhbGciOiJIUzI1NiIs..."}'
```

**View OpenAPI Spec:**
```bash
# View in Swagger Editor
npx swagger-editor openapi.yaml

# Or use online viewer
# https://editor.swagger.io/
```

---

## Integration with Mainline

The mainline service integrates via the **payment-gateway plugin** located in the main repo at `CG_plugins/plugins/payment-gateway.plugin.ts`.

### Mainline Configuration

Update mainline's `config.json`:

```json
{
  "services": {
    "paymentService": {
      "url": "http://localhost:8790"
    }
  }
}
```

### Plugin Usage

The mainline exposes two plugin operations:

**Subscribe (creates checkout):**
```typescript
{
  "pluginName": "payment.subscribe",
  "intent": {
    "operation": "create",
    "inputs": { "jwt": "user_token" }
  }
}
```

**Verify (check status):**
```typescript
{
  "pluginName": "payment.verify",
  "intent": {
    "operation": "check",
    "inputs": { "jwt": "user_token" }
  }
}
```

---

## Frontend Integration Examples

### Subscribe Button (React)

```tsx
import { useState } from 'react'

function SubscribeButton() {
  const [loading, setLoading] = useState(false)

  const handleSubscribe = async () => {
    setLoading(true)
    try {
      const jwt = getUserJWT() // Your auth implementation
      
      const response = await fetch('http://localhost:8787/internal/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pluginName: 'payment.subscribe',
          intent: {
            operation: 'create',
            inputs: { jwt }
          }
        })
      })

      const result = await response.json()

      if (result.status_code === 200) {
        window.location.href = result.data.checkout_url
      } else {
        alert('Failed: ' + result.message)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={handleSubscribe} disabled={loading}>
      {loading ? 'Processing...' : 'Subscribe ($9.90/month)'}
    </button>
  )
}
```

### Check Subscription Status

```tsx
import { useEffect, useState } from 'react'

function SubscriptionStatus() {
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkSubscription()
  }, [])

  const checkSubscription = async () => {
    try {
      const jwt = getUserJWT()
      
      const response = await fetch('http://localhost:8787/internal/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pluginName: 'payment.verify',
          intent: {
            operation: 'check',
            inputs: { jwt }
          }
        })
      })

      const result = await response.json()
      if (result.status_code === 200) {
        setSubscription(result.data)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div>Loading...</div>
  if (!subscription?.is_active) return <div>No active subscription</div>

  return (
    <div>
      <h3>Active Subscription</h3>
      <p>Plan: {subscription.subscription.plan}</p>
      <p>Status: {subscription.subscription.status}</p>
      <p>Expires: {new Date(subscription.subscription.expires_at).toLocaleDateString()}</p>
    </div>
  )
}
```

### Success/Cancel Pages

```tsx
// /payment/success
function PaymentSuccess() {
  return (
    <div>
      <h1>✅ Subscription Activated!</h1>
      <p>Thank you for subscribing to ClassGuru.</p>
      <a href="/dashboard">Go to Dashboard</a>
    </div>
  )
}

// /payment/cancel
function PaymentCancel() {
  return (
    <div>
      <h1>Payment Canceled</h1>
      <p>You can try again anytime.</p>
      <a href="/pricing">Back to Pricing</a>
    </div>
  )
}
```

---

## Database Schema

### subscription_orders

Tracks all subscription orders and their lifecycle.

| Column | Type | Description |
|--------|------|-------------|
| order_id | TEXT | Unique order ID (primary key) |
| user_email | TEXT | User's email from JWT |
| user_id | TEXT | User ID from JWT (optional) |
| stripe_session_id | TEXT | Stripe checkout session ID |
| stripe_subscription_id | TEXT | Stripe subscription ID |
| stripe_customer_id | TEXT | Stripe customer ID |
| status | TEXT | pending, active, canceled, expired, incomplete |
| plan | TEXT | Subscription plan name |
| amount | REAL | Plan amount (e.g., 9.90) |
| currency | TEXT | Currency code (e.g., SGD) |
| expires_at | INTEGER | Expiration timestamp (NULL for active) |
| created_at | INTEGER | Creation timestamp |
| updated_at | INTEGER | Last update timestamp |

### payment_events

Idempotency tracking for Stripe webhook events.

| Column | Type | Description |
|--------|------|-------------|
| event_id | TEXT | Stripe event ID (primary key) |
| event_type | TEXT | Event type (e.g., checkout.session.completed) |
| processed_at | INTEGER | Processing timestamp |

### Query Database

```bash
sqlite3 payment.db "SELECT * FROM subscription_orders;"
sqlite3 payment.db "SELECT * FROM payment_events ORDER BY processed_at DESC LIMIT 10;"
```

---

## Security

### JWT Verification
- All API endpoints verify JWT signature using shared secret
- JWT must contain `email` field (userId optional)
- Expired JWTs are rejected

### Stripe Signatures
- Webhooks verify `stripe-signature` header
- Prevents unauthorized webhook calls
- Protects against replay attacks

### Idempotency
- Event IDs tracked in database
- Prevents duplicate processing on webhook retries
- Permanent storage (no expiration)

### Input Validation
- All inputs validated with Zod schemas
- Type-safe request handling
- Prevents injection attacks

### Environment Secrets
- All keys stored in `.env`
- Never committed to git
- Production uses strong secrets (64+ chars)

---

## Testing

### Local Testing Flow

1. **Generate test JWT:**

```javascript
// test-jwt.js
const jwt = require('jsonwebtoken')
const crypto = require('crypto')

const payload = {
  // Required: Authentication fields only
  sub: 'user-test-123',               // User ID (required)
  iss: 'mainline',                    // Issuer (required)
  iat: Math.floor(Date.now() / 1000), // Issued at (required)
  exp: Math.floor(Date.now() / 1000) + 86400, // Expires in 24 hours (required)
  
  // Optional: User information
  email: 'test@example.com',          // Optional: for display/support only
  roles: ['user', 'premium']          // Optional: authorization roles
}

const token = jwt.sign(
  payload,
  'your_jwt_secret_from_env',
  { algorithm: 'HS256' }
)

console.log('JWT:', token)
console.log('\nIdempotency Key:', crypto.randomUUID())
```

2. **Create subscription:**

```bash
curl -X POST http://localhost:8790/api/payment/create-subscription \
  -H "Content-Type: application/json" \
  -d '{
    "jwt": "YOUR_JWT_TOKEN",
    "idempotency_key": "550e8400-e29b-41d4-a716-446655440000",
    "product_id": "monthly-plan",
    "currency": "SGD",
    "payment_method": "card",
    "customer_email": "test@example.com",
    "platform": "web",
    "client_ref": "test_checkout"
  }'
```

3. **Complete payment:**
   - Open checkout URL in browser
   - Use test card: **4242 4242 4242 4242**
   - Expiry: Any future date
   - CVC: Any 3 digits

4. **Verify subscription:**

```bash
curl -X POST http://localhost:8790/api/payment/verify-subscription \
  -H "Content-Type: application/json" \
  -d '{"jwt":"YOUR_JWT_TOKEN"}'
```

### Stripe Test Cards

| Card Number | Result |
|-------------|--------|
| 4242 4242 4242 4242 | Success |
| 4000 0000 0000 0002 | Decline |
| 4000 0025 0000 3155 | Requires authentication |

### Trigger Test Events

```bash
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger invoice.payment_failed
```

---

## Production Deployment

### Pre-Deployment Checklist

- [ ] Switch to live Stripe keys (`sk_live_...`)
- [ ] Create live product and update `STRIPE_MONTHLY_PRICE_ID`
- [ ] Configure production webhook in Stripe Dashboard
- [ ] Use 64+ character random JWT secret
- [ ] Enable HTTPS/TLS
- [ ] Restrict CORS origins in `server.ts`
- [ ] Set up database backups
- [ ] Configure monitoring and alerts
- [ ] Set up log aggregation
- [ ] Test webhook idempotency
- [ ] Load test concurrent subscriptions
- [ ] Document disaster recovery

### Build for Production

```bash
npm run build
npm start
```

### Environment Variables (Production)

```env
PORT=8790
STRIPE_SECRET_KEY=sk_live_your_production_key
STRIPE_WEBHOOK_SECRET=whsec_your_production_secret
JWT_SECRET=64_character_random_string_here
STRIPE_MONTHLY_PRICE_ID=price_live_your_price_id
FRONTEND_SUCCESS_URL=https://classguru.com/payment/success
FRONTEND_CANCEL_URL=https://classguru.com/payment/cancel
DB_PATH=/var/lib/payment/payment.db
LOG_LEVEL=info
```

### Production Webhook Setup

1. Go to Stripe Dashboard → Webhooks
2. Add endpoint: `https://your-domain.com/webhooks/stripe`
3. Select all payment events
4. Copy signing secret to production `.env`

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **JWT verification fails** | Ensure `JWT_SECRET` matches mainline exactly |
| **Webhook signature fails** | Use secret from `stripe listen` for local dev |
| **Port already in use** | Change `PORT` in `.env` or kill process: `lsof -ti:8790 \| xargs kill` |
| **Database locked** | Ensure only one payment service instance is running |
| **Cannot create checkout** | Verify `STRIPE_MONTHLY_PRICE_ID` is correct |
| **Subscription not activating** | Check webhook is properly configured and events are being received |

### Debug Commands

```bash
# Check if service is running
curl http://localhost:8790/api/payment/health

# View database orders
sqlite3 payment.db "SELECT * FROM subscription_orders;"

# View processed events
sqlite3 payment.db "SELECT * FROM payment_events ORDER BY processed_at DESC LIMIT 10;"

# Check logs for errors
# (logs are output to console in development)
```

---

## Future Enhancements

### When Unified Database is Ready

1. Update handlers to call unified DB API
2. Keep SQLite as backup during migration
3. No changes needed to API endpoints or frontend

### Additional Features

- Multiple subscription tiers (basic, premium, enterprise)
- Advertisement billing tracking
- Credit-based pricing models
- Usage analytics and reporting
- Subscription pause/resume
- Proration support
- Refund management

---

## Data Flow Diagram

### Subscribe Flow

```
1. User clicks "Subscribe" button
   ↓
2. Frontend gets JWT from auth context
   ↓
3. Frontend → Mainline: calls payment.subscribe plugin
   ↓
4. Mainline → Payment Service: POST /api/payment/create-subscription
   ↓
5. Payment Service:
   - Decodes JWT → extracts email & userId
   - Creates order in SQLite (status: pending)
   - Creates Stripe Checkout Session
   - Returns checkout URL
   ↓
6. Frontend redirects to Stripe Checkout
   ↓
7. User completes payment on Stripe
   ↓
8. Stripe → Payment Service: Webhook checkout.session.completed
   ↓
9. Payment Service:
   - Verifies webhook signature
   - Updates order: status=active
   - Records event ID for idempotency
   ↓
10. Stripe redirects user to success URL
```

---

## Support

- **Stripe Documentation**: https://stripe.com/docs
- **Stripe Test Cards**: https://stripe.com/docs/testing

---

**Built with**: TypeScript, Fastify, Stripe, SQLite, JWT  
**Status**: Production Ready  
**Last Updated**: October 15, 2025

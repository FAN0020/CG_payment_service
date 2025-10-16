# Authentication & Payment Flow Explained

## The Two Independent Systems

Your payment service uses **two completely separate authentication mechanisms**:

### 1. JWT Authentication (API Access Control)

**Purpose**: Proves that the caller is a legitimate user of YOUR service

```
Client Request
     │
     ├─ Header: Authorization: Bearer eyJhbGc...
     │
     ▼
┌─────────────────────────┐
│  Payment Service API    │
│  1. Extract JWT token   │
│  2. Verify with         │
│     JWT_SECRET          │
│  3. Validate payload    │
│     - sub (user_id)     │
│     - iss (issuer)      │
│     - exp (expiration)  │
└─────────────────────────┘
     │
     ├─ ✅ Valid → Allow request
     └─ ❌ Invalid → 401 Unauthorized
```

**What it does**:
- ✅ Confirms user identity
- ✅ Prevents unauthorized API access
- ✅ Extracted from `Authorization: Bearer <token>` header

**What it does NOT do**:
- ❌ Doesn't talk to Stripe
- ❌ Doesn't process payments
- ❌ Doesn't validate payment methods

### 2. Stripe Authentication (Payment Processing)

**Purpose**: Allows your service to communicate with Stripe's API

```
Payment Service
     │
     ├─ Need to create checkout session
     │
     ▼
┌─────────────────────────┐
│  Stripe API             │
│  Authentication:        │
│  Authorization: Bearer  │
│    STRIPE_SECRET_KEY    │
│                         │
│  Creates checkout       │
│  session for payment    │
└─────────────────────────┘
     │
     └─ Returns: checkout_url
```

**What it does**:
- ✅ Authenticates YOUR SERVICE to Stripe
- ✅ Creates checkout sessions
- ✅ Processes payments
- ✅ Manages subscriptions

**What it does NOT do**:
- ❌ Doesn't know about your users
- ❌ Doesn't validate JWT tokens
- ❌ Doesn't care about your API security

## Complete Payment Flow

```
┌──────────────┐
│   Browser    │
│  (Your User) │
└──────┬───────┘
       │
       │ 1. Generate JWT token
       │    (signed with JWT_SECRET)
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│                    Your Mainline Service                      │
│                                                                │
│  const token = jwt.sign(                                      │
│    { sub: 'user-123', iss: 'mainline' },                     │
│    JWT_SECRET                                                 │
│  )                                                             │
└──────┬───────────────────────────────────────────────────────┘
       │
       │ 2. POST /api/v1/create-order
       │    Authorization: Bearer <JWT_TOKEN>
       │    X-Idempotency-Key: <unique-key>
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│              Payment Service (Port 8790)                      │
│                                                                │
│  Step 1: Validate JWT                                         │
│  ┌────────────────────────────────────────┐                  │
│  │ jwtManager.verify(token)               │                  │
│  │ → Uses JWT_SECRET                      │                  │
│  │ → Extracts user_id from payload.sub    │                  │
│  └────────────────────────────────────────┘                  │
│       │                                                        │
│       ▼                                                        │
│  Step 2: Check Idempotency                                    │
│  ┌────────────────────────────────────────┐                  │
│  │ db.getClientIdempotency(key, user_id)  │                  │
│  │ → If exists: return cached order       │                  │
│  │ → If not: proceed                      │                  │
│  └────────────────────────────────────────┘                  │
│       │                                                        │
│       ▼                                                        │
│  Step 3: Create Stripe Checkout Session                       │
│  ┌────────────────────────────────────────┐                  │
│  │ stripeManager.createCheckoutSession()  │                  │
│  │ → Uses STRIPE_SECRET_KEY               │                  │
│  │ → Calls Stripe API                     │                  │
│  │ → Returns checkout URL                 │                  │
│  └────────────────────────────────────────┘                  │
│       │                                                        │
│       ▼                                                        │
│  Step 4: Save Order to Database                               │
│  ┌────────────────────────────────────────┐                  │
│  │ db.createOrder({...})                  │                  │
│  │ db.recordClientIdempotency(...)        │                  │
│  └────────────────────────────────────────┘                  │
└──────┬───────────────────────────────────────────────────────┘
       │
       │ 3. Response: { checkout_url, order_id, ... }
       │
       ▼
┌──────────────┐
│   Browser    │ 4. Opens checkout_url in new tab
└──────┬───────┘
       │
       │ 5. User sees Stripe checkout page
       │    Enters card: 4242 4242 4242 4242
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│                    Stripe Checkout                            │
│                                                                │
│  - Collects payment information                               │
│  - Validates card                                             │
│  - Processes payment                                          │
│  - Creates subscription                                       │
└──────┬───────────────────────────────────────────────────────┘
       │
       │ 6. Sends webhook: checkout.session.completed
       │    Signature: <HMAC signature>
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│         Payment Service Webhook Endpoint                      │
│                                                                │
│  POST /webhooks/stripe                                        │
│                                                                │
│  Step 1: Verify Webhook Signature                             │
│  ┌────────────────────────────────────────┐                  │
│  │ stripeManager.verifyWebhookSignature() │                  │
│  │ → Uses STRIPE_WEBHOOK_SECRET           │                  │
│  │ → Confirms event came from Stripe      │                  │
│  └────────────────────────────────────────┘                  │
│       │                                                        │
│       ▼                                                        │
│  Step 2: Check Idempotency                                    │
│  ┌────────────────────────────────────────┐                  │
│  │ db.isEventProcessed(event.id)          │                  │
│  │ → Prevents duplicate processing        │                  │
│  └────────────────────────────────────────┘                  │
│       │                                                        │
│       ▼                                                        │
│  Step 3: Update Order Status                                  │
│  ┌────────────────────────────────────────┐                  │
│  │ db.updateOrder({                       │                  │
│  │   status: 'completed',                 │                  │
│  │   subscription_id: '...',              │                  │
│  │   stripe_customer_id: '...'            │                  │
│  │ })                                      │                  │
│  └────────────────────────────────────────┘                  │
│       │                                                        │
│       ▼                                                        │
│  Step 4: Record Event as Processed                            │
│  ┌────────────────────────────────────────┐                  │
│  │ db.recordEvent(event.id, event.type)   │                  │
│  └────────────────────────────────────────┘                  │
└──────┬───────────────────────────────────────────────────────┘
       │
       │ 7. Returns 200 OK to Stripe
       │
       ▼
     ┌─────────────────┐
     │ Stripe redirects│
     │ user to:        │
     │ SUCCESS_URL     │
     └─────────────────┘
```

## Key Insights

### 1. JWT Never Touches Stripe
```javascript
// JWT is ONLY for your API authentication
const jwtPayload = {
  sub: 'user-123',      // User ID in YOUR system
  iss: 'mainline',      // YOUR service identifier
  email: 'user@example.com'  // Optional, for display only
}

// Stripe doesn't see or care about this JWT
```

### 2. Stripe Doesn't Know Your Users
```javascript
// When creating Stripe checkout session:
await stripe.checkout.sessions.create({
  // NO user authentication here!
  // Stripe only gets:
  line_items: [{ price: 'price_123', quantity: 1 }],
  metadata: { order_id: 'ord_xyz' },  // Your internal reference
  customer_email: 'user@example.com'  // Optional display only
})

// Stripe returns a URL anyone can open
// But only YOU know it belongs to user-123 (via order_id)
```

### 3. Email in JWT is NOT for Stripe
```javascript
// Common confusion:
const jwtPayload = {
  sub: 'user-123',
  email: 'user@example.com'  // ← This is NOT sent to Stripe!
}

// If you want email in Stripe checkout:
await stripe.checkout.sessions.create({
  customer_email: 'user@example.com'  // ← Explicitly set here
})

// Or just let Stripe ask the user for their email
```

## Security Boundaries

### JWT Security Boundary
```
Client → [JWT Token] → Payment Service API
         ↑
         Validated here
         Using JWT_SECRET
         
✅ Protects: API endpoints from unauthorized access
❌ Doesn't protect: Stripe operations (different secret)
```

### Stripe Security Boundary
```
Payment Service → [Stripe Secret Key] → Stripe API
                  ↑
                  Authenticated here
                  Using STRIPE_SECRET_KEY

✅ Protects: Stripe API from unauthorized services
❌ Doesn't protect: Your API endpoints (different secret)
```

### Webhook Security Boundary
```
Stripe → [Signed Event] → Payment Service Webhook
         ↑
         Verified here
         Using STRIPE_WEBHOOK_SECRET
         
✅ Protects: Against fake webhook events
❌ Doesn't protect: API endpoints (use JWT for that)
```

## Testing Scenarios

### Scenario 1: Valid JWT + Valid Stripe
```bash
✅ JWT Token: Valid (signed with correct JWT_SECRET)
✅ Stripe Keys: Valid (real sk_test_... key)
✅ Result: Full payment flow works, real checkout URL created
```

### Scenario 2: Valid JWT + Invalid Stripe
```bash
✅ JWT Token: Valid
❌ Stripe Keys: Fake (sk_test_demo_...)
❌ Result: API accepts request, but Stripe creation fails/timeouts
```

### Scenario 3: Invalid JWT + Valid Stripe
```bash
❌ JWT Token: Invalid or missing
✅ Stripe Keys: Valid
❌ Result: Request rejected at API level (401 Unauthorized)
       Stripe never called (authentication failed earlier)
```

### Scenario 4: Demo JWT + Real Stripe (YOUR CASE)
```bash
✅ JWT Token: Valid (demo secret, but that's fine for testing!)
✅ Stripe Keys: Real test keys
✅ Result: WORKS PERFECTLY!
       - JWT validates user to YOUR service ✓
       - Stripe processes real test payments ✓
       - These systems are independent! ✓
```

## Common Mistakes

### ❌ Mistake 1: Trying to use JWT with Stripe
```javascript
// WRONG - Stripe doesn't accept JWTs
const session = await stripe.checkout.sessions.create({
  authorization: jwtToken  // ❌ Stripe doesn't know about this
})
```

### ❌ Mistake 2: Thinking email in JWT goes to Stripe
```javascript
// JWT payload
{ sub: 'user-123', email: 'user@example.com' }

// This email stays in YOUR service
// To pre-fill Stripe checkout, you must explicitly set:
customer_email: 'user@example.com'  // in checkout session params
```

### ❌ Mistake 3: Using Stripe key to validate webhooks
```javascript
// WRONG
verifyWebhook(event, STRIPE_SECRET_KEY)

// CORRECT
verifyWebhook(event, STRIPE_WEBHOOK_SECRET)  // Different secret!
```

## The Bottom Line

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  JWT Authentication      ←→      Stripe Authentication      │
│                                                              │
│  "Who is the user?"              "Can I create payments?"   │
│                                                              │
│  JWT_SECRET                      STRIPE_SECRET_KEY          │
│  Validates: API callers          Validates: Your service    │
│  Used by: Your API               Used by: Stripe API        │
│                                                              │
│  ┌─────────────────┐             ┌─────────────────┐       │
│  │  INDEPENDENT!   │◄───────────►│  INDEPENDENT!   │       │
│  └─────────────────┘             └─────────────────┘       │
│                                                              │
└─────────────────────────────────────────────────────────────┘

              You can use demo JWT with real Stripe!
              They don't know about each other!
```


# 🔌 Mainline Integration - Mock to Production

This document explains how the mock Stripe system is designed for **seamless integration with production**.

## ✅ Design Philosophy

The mock system follows these principles:

1. **Frontend Agnostic** - Frontend code has ZERO knowledge of mock vs real Stripe
2. **Transparent Switching** - Toggle between mock and real with ONE environment variable
3. **Identical Interface** - Both implementations use the same `IStripeManager` interface
4. **No Code Changes** - Same codebase works for development, testing, and production
5. **Environment-Based URLs** - All URLs are configurable, not hardcoded

---

## 🏗️ Architecture Overview

### Interface-Based Design

Both `StripeManager` (real) and `MockStripeManager` (mock) implement `IStripeManager`:

```typescript
export interface IStripeManager {
  stripe: any
  createCheckoutSession(params: CreateCheckoutSessionParams): Promise<Stripe.Checkout.Session>
  getSubscription(subscriptionId: string): Promise<StripeSubscriptionInfo>
  cancelSubscription(subscriptionId: string): Promise<void>
  verifyWebhookSignature(payload: string | Buffer, signature: string, secret: string): Stripe.Event
  getInstance(): any
}
```

**The server chooses which implementation to use** based on `MOCK_STRIPE_MODE`:

```typescript
// In src/server.ts
const stripeManager = config.mockMode
  ? new MockStripeManager(config.mockScenario)
  : new StripeManager(config.stripeSecretKey)
```

**Frontend doesn't know or care** which one is being used!

---

## 🔄 How It Works

### 1. Payment Flow (Frontend)

The frontend does this - **same for mock and real**:

```javascript
// 1. Call API to create subscription
const response = await fetch('/api/payment/create-subscription', {
  method: 'POST',
  body: JSON.stringify({
    jwt: token,
    product_id: 'monthly-plan',
    // ... other params
  })
})

// 2. Get checkout URL from response
const { checkout_url } = await response.json()

// 3. Redirect to checkout URL
window.location.href = checkout_url
```

**The frontend doesn't know if `checkout_url` is:**
- Real Stripe: `https://checkout.stripe.com/c/pay/cs_test_...`
- Mock Stripe: `http://localhost:8790/mock-stripe/checkout?session_id=...`

### 2. Checkout Session Creation (Backend)

Both implementations return the same structure:

**Real Stripe:**
```typescript
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  line_items: [{ price: priceId, quantity: 1 }],
  success_url: params.successUrl,  // ✅ From env config
  cancel_url: params.cancelUrl,    // ✅ From env config
  metadata: { order_id: orderId }
})

return session  // Has session.url pointing to Stripe
```

**Mock Stripe:**
```typescript
const checkoutUrl = `${baseUrl}/mock-stripe/checkout?session_id=${sessionId}&success_url=${encodeURIComponent(params.successUrl)}&cancel_url=${encodeURIComponent(params.cancelUrl)}`

return {
  id: sessionId,
  url: checkoutUrl,  // Points to mock page
  success_url: params.successUrl,  // ✅ Same config
  cancel_url: params.cancelUrl,    // ✅ Same config
  // ... other fields
}
```

### 3. Success/Cancel Callbacks

**Real Stripe** redirects to:
```
https://yourdomain.com/payment?status=success&session_id=cs_test_...&order_id=ord_...
```

**Mock Stripe** redirects to:
```
https://yourdomain.com/payment?status=success&session_id=cs_mock_...&order_id=ord_...
```

**The frontend handles both identically** - checks `?status=success` or `?status=cancel`

---

## 🌐 Environment Configuration

### Development (Mock Mode)

```bash
# .env.development
MOCK_STRIPE_MODE=true
MOCK_STRIPE_SCENARIO=success

# URLs work for any environment
FRONTEND_SUCCESS_URL=http://localhost:8790/payment?status=success
FRONTEND_CANCEL_URL=http://localhost:8790/payment?status=cancel

JWT_SECRET=dev-secret-key

# Stripe credentials NOT required in mock mode
# STRIPE_SECRET_KEY=  (not needed)
# STRIPE_WEBHOOK_SECRET=  (not needed)
# STRIPE_MONTHLY_PRICE_ID=  (not needed)
```

### Production (Real Stripe)

```bash
# .env.production
MOCK_STRIPE_MODE=false

# Production URLs - automatically used by both mock and real
FRONTEND_SUCCESS_URL=https://app.classguru.ai/payment?status=success
FRONTEND_CANCEL_URL=https://app.classguru.ai/payment?status=cancel

JWT_SECRET=production-secret-key

# Real Stripe credentials
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_MONTHLY_PRICE_ID=price_...
```

### Staging (Could use either)

```bash
# Option 1: Use mock for isolated testing
MOCK_STRIPE_MODE=true
MOCK_STRIPE_SCENARIO=success
FRONTEND_SUCCESS_URL=https://staging.classguru.ai/payment?status=success
FRONTEND_CANCEL_URL=https://staging.classguru.ai/payment?status=cancel

# Option 2: Use real Stripe test mode
MOCK_STRIPE_MODE=false
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_MONTHLY_PRICE_ID=price_...
FRONTEND_SUCCESS_URL=https://staging.classguru.ai/payment?status=success
FRONTEND_CANCEL_URL=https://staging.classguru.ai/payment?status=cancel
```

---

## 📋 Integration Checklist

### ✅ What's Already Done

- [x] **Interface-based design** - Both implementations use `IStripeManager`
- [x] **Environment-based switching** - Single `MOCK_STRIPE_MODE` flag
- [x] **Dynamic URLs** - Success/cancel URLs from environment, not hardcoded
- [x] **Frontend agnostic** - Zero mock-specific code in frontend
- [x] **Same API contract** - Identical request/response format
- [x] **Consistent callbacks** - Same URL parameters for success/cancel
- [x] **Server-side type safety** - TypeScript ensures both implementations match

### 🔧 What You Need to Do for Production

1. **Set environment variables**:
   ```bash
   MOCK_STRIPE_MODE=false
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_MONTHLY_PRICE_ID=price_...
   FRONTEND_SUCCESS_URL=https://yourdomain.com/payment?status=success
   FRONTEND_CANCEL_URL=https://yourdomain.com/payment?status=cancel
   ```

2. **Configure Stripe webhook** in Stripe Dashboard:
   - Add webhook endpoint: `https://yourdomain.com/webhooks/stripe`
   - Select events: `checkout.session.completed`, `invoice.payment_succeeded`, etc.
   - Copy webhook secret to `STRIPE_WEBHOOK_SECRET`

3. **Deploy** - No code changes needed!

4. **Test** with Stripe test mode first:
   ```bash
   MOCK_STRIPE_MODE=false
   STRIPE_SECRET_KEY=sk_test_...  # Use test key first
   ```

---

## 🧪 Testing Strategy

### Local Development
```bash
# Quick iteration with mock
MOCK_STRIPE_MODE=true npm run dev
```

### Integration Testing
```bash
# Test with real Stripe test mode
MOCK_STRIPE_MODE=false 
STRIPE_SECRET_KEY=sk_test_...
npm run dev
```

### Production
```bash
# Use real Stripe with live keys
MOCK_STRIPE_MODE=false
STRIPE_SECRET_KEY=sk_live_...
npm start
```

---

## 🔍 Verification

### How to Verify It Works for Production

1. **Check interface consistency**:
   ```bash
   # Both should have same methods
   grep -A 5 "interface IStripeManager" src/lib/stripe.ts
   ```

2. **Check server initialization**:
   ```typescript
   // In src/server.ts - should see conditional initialization
   const stripeManager = config.mockMode
     ? new MockStripeManager(...)
     : new StripeManager(...)
   ```

3. **Check frontend code**:
   ```bash
   # Should find ZERO references to "mock" or "MOCK"
   grep -i "mock" frontend/app.js frontend/index.html
   # Only mock-checkout.html should have mock references
   ```

4. **Check URL configuration**:
   ```bash
   # Should be from env, not hardcoded
   grep -n "success_url\|cancel_url" src/server.ts
   ```

---

## 🚀 Deployment Scenarios

### Scenario 1: Local Development
- **Mode**: Mock
- **URLs**: `localhost:8790`
- **Benefit**: No Stripe setup needed, fast iteration

### Scenario 2: Staging with Mock
- **Mode**: Mock
- **URLs**: `staging.classguru.ai`
- **Benefit**: Test deployment without Stripe test keys

### Scenario 3: Staging with Stripe Test
- **Mode**: Real (test keys)
- **URLs**: `staging.classguru.ai`
- **Benefit**: Full Stripe integration testing

### Scenario 4: Production
- **Mode**: Real (live keys)
- **URLs**: `app.classguru.ai`
- **Benefit**: Real payments with real Stripe

**In ALL scenarios, the same codebase is used!**

---

## 💡 Key Design Decisions

### Why Interface-Based?
- Ensures both implementations have identical methods
- TypeScript compiler catches any inconsistencies
- Server can swap implementations at runtime

### Why Environment-Based URLs?
- Works in any deployment (localhost, staging, production)
- No hardcoded `localhost:8790` in production
- Single source of truth (environment config)

### Why Frontend Agnostic?
- No conditional logic in frontend
- Easier to maintain
- Same frontend bundle for all environments

### Why Mock Checkout Page?
- Simulates Stripe's flow realistically
- Users see what production will look like
- Supports multiple test scenarios

---

## 🎯 Summary

**The mock system is production-ready because:**

1. ✅ **Zero frontend changes** - Same code for mock and real
2. ✅ **Zero backend API changes** - Same interface for both
3. ✅ **Environment-driven** - One flag to switch modes
4. ✅ **URL-agnostic** - Works on any domain/port
5. ✅ **Type-safe** - TypeScript ensures consistency
6. ✅ **Tested** - Works identically to real Stripe flow

**To go to production, you ONLY need to:**
1. Set `MOCK_STRIPE_MODE=false`
2. Add real Stripe credentials
3. Configure webhook endpoint
4. Deploy!

**No code changes. No frontend modifications. No API contract changes.**

That's seamless integration! 🎉


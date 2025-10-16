# Quick Start Guide

## TL;DR - Testing with Demo JWT + Real Stripe

**YES**, you can use demo JWT tokens with real Stripe test keys! They are completely independent:

```
┌─────────────┐         JWT          ┌──────────────────┐      Stripe Keys    ┌────────────┐
│   Client    │ ──────────────────> │  Your Payment    │ ──────────────────> │   Stripe   │
│  (Browser)  │   "I'm user X"       │     Service      │  "Create session"   │    API     │
└─────────────┘                      └──────────────────┘                      └────────────┘
                                              │
                                              │
                                     ✓ JWT validates user identity
                                     ✓ Stripe processes actual payment
```

## Setup in 3 Steps

### 1. Get Stripe Test Keys (5 minutes)

```bash
# 1. Sign up: https://dashboard.stripe.com/register
# 2. Stay in "Test mode"
# 3. Get keys:
#    - API Keys: https://dashboard.stripe.com/test/apikeys
#    - Copy: sk_test_... (secret key)
#
# 4. Create product: https://dashboard.stripe.com/test/products
#    - Name: "ClassGuruAI Monthly"
#    - Price: $9.90/month recurring
#    - Copy: price_... (price ID)
#
# 5. Setup webhook: https://dashboard.stripe.com/test/webhooks
#    - For local: Use ngrok (see below)
#    - Events: checkout.session.completed, customer.subscription.*
#    - Copy: whsec_... (signing secret)
```

### 2. Configure Environment

```bash
# Copy example config
cp env.example .env

# Edit .env - replace these 3 values:
# STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
# STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET_HERE
# STRIPE_MONTHLY_PRICE_ID=price_YOUR_PRICE_ID_HERE

# Keep JWT_SECRET as-is for testing:
# JWT_SECRET=demo-secret-key-change-in-production
```

### 3. Run Tests

```bash
# Terminal 1: Start service
npm run dev

# Terminal 2: Setup ngrok for webhooks
ngrok http 8790
# Copy the HTTPS URL and update webhook in Stripe Dashboard

# Terminal 3: Run test
npm run test:stripe
```

## Testing Without Stripe (Mock Mode)

If you don't want to setup Stripe yet, you can test with mock mode:

1. Keep the demo Stripe keys in `.env`
2. API will return mock checkout URLs
3. Perfect for testing idempotency and JWT validation
4. Won't create real Stripe sessions

## Commands

```bash
# Generate JWT token for manual testing
npm run generate-jwt
npm run generate-jwt user-123 test@example.com

# Full end-to-end test with Stripe
npm run test:stripe

# Start development server
npm run dev

# Type checking
npm run type-check
```

## Test Cards (Stripe)

When you open the checkout URL:

| Card Number         | Result  |
|---------------------|---------|
| 4242 4242 4242 4242 | Success |
| 4000 0000 0000 0002 | Decline |
| 4000 0025 0000 3155 | Requires authentication |

- **Expiry**: Any future date (e.g., 12/34)
- **CVC**: Any 3 digits (e.g., 123)
- **Email**: Any email

## Local Webhook Setup

### Option 1: ngrok (Easiest)

```bash
# Install
brew install ngrok

# Run (in separate terminal)
ngrok http 8790

# Copy HTTPS URL (e.g., https://abc123.ngrok.io)
# Update webhook in Stripe:
#   URL: https://abc123.ngrok.io/webhooks/stripe
```

### Option 2: Stripe CLI

```bash
# Install
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks
stripe listen --forward-to localhost:8790/webhooks/stripe

# Copy webhook secret (whsec_...) to .env
```

## API Examples

### Create Order

```bash
# First, generate a JWT token
TOKEN=$(npm run generate-jwt | grep "Bearer" | awk '{print $2}')

# Create order
curl -X POST http://localhost:8790/api/v1/create-order \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: unique-key-123" \
  -d '{
    "user_id": "test-user-123"
  }'
```

### Check Order Status

```bash
curl http://localhost:8790/api/v1/orders/ORDER_ID \
  -H "Authorization: Bearer $TOKEN"
```

### Query Subscription

```bash
curl -X POST http://localhost:8790/api/v1/query-subscription \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-user-123"
  }'
```

## Troubleshooting

### "Invalid Stripe secret key"
- Using fake demo keys
- **Fix**: Get real test keys from Stripe Dashboard

### Request timeout when creating order
- Fake Stripe keys that don't connect to Stripe
- **Fix**: Use real `sk_test_...` keys

### "Webhook signature verification failed"
- Wrong webhook secret or URL mismatch
- **Fix**: Ensure webhook URL matches your ngrok URL

### "JWT verification failed"
- JWT signed with wrong secret
- **Fix**: Use same `JWT_SECRET` from `.env` when generating tokens

## Need More Details?

- **Full Setup Guide**: `STRIPE_SETUP_GUIDE.md`
- **API Documentation**: `README.md`
- **OpenAPI Spec**: `openapi.yaml`
- **Architecture**: `ARCHITECTURE.md`

## Production Deploy

When ready for production:

1. **Generate strong JWT secret**:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Switch to Stripe Live mode**:
   - Get live API keys (sk_live_...)
   - Create production webhook with your domain
   - Update all URLs to production domain

3. **Update environment variables** on production server

4. **Test thoroughly** with live test cards before going live

---

**Remember**: JWT and Stripe are independent! 
- JWT = "Who is calling my API?" 
- Stripe = "Process this payment"


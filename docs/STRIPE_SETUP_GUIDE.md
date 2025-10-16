# Stripe Setup Guide for Testing

## Understanding JWT vs Stripe Authentication

Your payment service uses **two independent authentication systems**:

### 1. JWT Authentication (Your API Security)
- **Purpose**: Verifies that API callers are legitimate users of YOUR service
- **Secret**: `JWT_SECRET` (currently `demo-secret-key-change-in-production`)
- **Usage**: Every API request to `/api/v1/*` endpoints requires a JWT token
- **Independence**: This has NOTHING to do with Stripe!

### 2. Stripe Authentication (Payment Processing)
- **Purpose**: Allows your service to communicate with Stripe's API
- **Keys**: `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`
- **Usage**: Your server uses these to create checkout sessions, retrieve subscriptions, etc.
- **Independence**: Stripe doesn't care about your JWT tokens!

## How They Work Together

```
┌─────────────┐         JWT          ┌──────────────────┐      Stripe Keys    ┌────────────┐
│   Client    │ ──────────────────> │  Your Payment    │ ──────────────────> │   Stripe   │
│  (Browser)  │   "I'm user X"       │     Service      │  "Create session"   │    API     │
└─────────────┘                      └──────────────────┘                      └────────────┘
                                              │
                                              │
                                     Validates JWT ✓
                                     Uses Stripe Key ✓
                                     Creates order ✓
```

## Setting Up Real Stripe Test Keys

### Step 1: Get Stripe Test Keys

1. **Sign up for Stripe** (free): https://dashboard.stripe.com/register
2. **Stay in Test Mode** (toggle in top right should say "Test mode")
3. **Get your keys**:
   - Go to: https://dashboard.stripe.com/test/apikeys
   - Copy **Secret key** (starts with `sk_test_...`)
   - Copy **Publishable key** (starts with `pk_test_...`)

### Step 2: Create a Test Product

1. Go to: https://dashboard.stripe.com/test/products
2. Click **"Add product"**
3. Create a product:
   - Name: "ClassGuruAI Monthly Subscription"
   - Description: "Monthly access to ClassGuruAI platform"
4. Add pricing:
   - Click **"Add another price"**
   - Model: **Recurring**
   - Price: $9.90 SGD (or your currency)
   - Billing period: **Monthly**
5. **Save** and copy the **Price ID** (starts with `price_...`)

### Step 3: Set Up Webhook

1. Go to: https://dashboard.stripe.com/test/webhooks
2. Click **"Add endpoint"**
3. Configure:
   - **Endpoint URL**: `https://your-domain.com/webhooks/stripe`
     - For local testing: Use [ngrok](https://ngrok.com) or similar tunnel
     - Example: `https://abc123.ngrok.io/webhooks/stripe`
4. **Select events to listen to**:
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.paid`
   - ✅ `invoice.payment_failed`
5. **Save** and copy the **Signing secret** (starts with `whsec_...`)

### Step 4: Update Your .env File

Create or update `.env` in the project root:

```bash
# Server Configuration
PORT=8790
DB_PATH=./data/payment.db

# JWT Authentication (for YOUR API)
# Keep this as-is for testing, or generate a new 32+ char secret
JWT_SECRET=demo-secret-key-change-in-production

# Stripe Configuration (REPLACE with your test keys)
STRIPE_SECRET_KEY=sk_test_51ABC...xyz  # Your Stripe secret key
STRIPE_WEBHOOK_SECRET=whsec_ABC...xyz  # Your webhook signing secret
STRIPE_MONTHLY_PRICE_ID=price_ABC123   # Your product price ID

# Plan Configuration
MONTHLY_PLAN_AMOUNT=9.90
MONTHLY_PLAN_CURRENCY=SGD

# Frontend URLs (where users are redirected after payment)
FRONTEND_SUCCESS_URL=http://localhost:3000/payment/success
FRONTEND_CANCEL_URL=http://localhost:3000/payment/cancel
```

## Testing with Demo JWT + Real Stripe

### The Answer to Your Question

**YES, you can use demo JWT with real Stripe test keys!**

Here's why:
1. **JWT**: Just proves "I'm a valid user" to YOUR service
2. **Stripe**: Handles actual payment processing
3. They're **completely independent**!

### Complete Test Flow

1. **Generate a test JWT token** (using your demo secret):
```javascript
const jwt = require('jsonwebtoken');
const token = jwt.sign(
  { 
    sub: 'test-user-123',  // User ID
    iss: 'mainline',       // Issuer
    email: 'test@example.com'
  },
  'demo-secret-key-change-in-production',  // Your JWT secret
  { expiresIn: '7d' }
);
console.log('JWT Token:', token);
```

2. **Make API request** with the JWT:
```bash
curl -X POST http://localhost:8790/api/v1/create-order \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: unique-key-123" \
  -d '{
    "user_id": "test-user-123"
  }'
```

3. **Your service will**:
   - ✅ Validate JWT (using `JWT_SECRET`)
   - ✅ Create order in database
   - ✅ Call Stripe API (using `STRIPE_SECRET_KEY`)
   - ✅ Return a **REAL** Stripe checkout URL!

4. **Open the checkout URL** in browser:
   - You'll see a real Stripe checkout page
   - Use [Stripe test cards](https://stripe.com/docs/testing#cards):
     - Success: `4242 4242 4242 4242`
     - Expiry: Any future date (e.g., `12/34`)
     - CVC: Any 3 digits (e.g., `123`)

5. **Complete payment**:
   - Stripe sends webhook to your service
   - Your service updates order status to "completed"
   - User is redirected to success URL

## Local Development with Webhooks

Since Stripe can't reach `localhost`, use a tunnel:

### Option 1: ngrok (Recommended)
```bash
# Install ngrok
brew install ngrok  # macOS
# or download from https://ngrok.com

# Start your service
npm run dev

# In another terminal, create tunnel
ngrok http 8790

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Update webhook endpoint in Stripe Dashboard:
# https://abc123.ngrok.io/webhooks/stripe
```

### Option 2: Stripe CLI (Alternative)
```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe  # macOS

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:8790/webhooks/stripe

# This gives you a webhook secret (whsec_...)
# Use it in your .env file
```

## Testing Checklist

- [ ] Created Stripe account and in Test mode
- [ ] Copied API keys (sk_test_... and pk_test_...)
- [ ] Created product and got price ID (price_...)
- [ ] Set up webhook and got signing secret (whsec_...)
- [ ] Updated `.env` file with all Stripe values
- [ ] Set up ngrok or Stripe CLI for local webhooks
- [ ] Generated JWT token for testing
- [ ] Made test API request
- [ ] Received Stripe checkout URL
- [ ] Completed test payment with `4242 4242 4242 4242`
- [ ] Webhook received and order status updated

## Common Issues

### Issue: "Invalid Stripe secret key"
- **Cause**: Using fake demo keys
- **Fix**: Replace with real test keys from Stripe Dashboard

### Issue: "Webhook signature verification failed"
- **Cause**: Wrong webhook secret or URL mismatch
- **Fix**: Ensure webhook URL in Stripe matches your ngrok URL

### Issue: "JWT verification failed"
- **Cause**: JWT signed with different secret
- **Fix**: Use same secret from `.env` when generating tokens

### Issue: Request timeout when creating order
- **Cause**: Fake Stripe keys that don't work
- **Fix**: Use real test keys from Stripe Dashboard

## Production Considerations

When deploying to production:

1. **Switch to Live Mode** in Stripe Dashboard
2. **Generate new secrets**:
   - New live API keys (sk_live_...)
   - New webhook secret for production URL
   - New JWT secret (32+ random characters)
3. **Update environment variables** on production server
4. **Use real domain** for webhook endpoint
5. **Test thoroughly** with live mode test cards first

## Need Help?

- Stripe Docs: https://stripe.com/docs
- Stripe Test Cards: https://stripe.com/docs/testing
- Stripe Dashboard: https://dashboard.stripe.com
- Support: support@stripe.com


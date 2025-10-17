# 🧪 Mock Stripe Testing Guide

Test the payment flow without setting up Stripe credentials!

## Quick Start

### 1. Run the Interactive Script

```bash
npm run mock-stripe
```

This will show you a menu of test scenarios:

```
1. ✅ Successful Payment
2. ❌ Cancelled Payment
3. ⏰ Expired Session
4. 💳 Invalid Card
5. 🔗 Webhook Failure
6. 🌐 Real Stripe (requires setup)
```

### 2. Set Environment Variables

The script will tell you which environment variables to set. For example, for a successful payment test:

```bash
export MOCK_STRIPE_MODE="true"
export MOCK_STRIPE_SCENARIO="success"
```

### 3. Restart the Server

```bash
npm run dev
```

### 4. Test the Payment Flow

1. Visit http://localhost:8790/payment
2. Click any "Subscribe" button
3. Enter a JWT token (or use `npm run generate-jwt`)
4. Watch the mock Stripe checkout page
5. See the result!

## Available Scenarios

### `success` ✅
- **What it does**: Simulates a successful payment
- **Flow**: Creates order → Mock Stripe checkout → Auto-redirects (5s) → Success page
- **Best for**: Testing the happy path

### `cancel` ❌
- **What it does**: User cancels during checkout
- **Flow**: Creates order → Mock Stripe checkout → User clicks cancel → Cancel page
- **Best for**: Testing cancellation handling

### `expired` ⏰
- **What it does**: Checkout session has expired
- **Flow**: Fails during checkout session creation
- **Best for**: Testing error handling

### `invalid_card` 💳
- **What it does**: Card payment fails
- **Flow**: Creates order → Mock Stripe checkout → Card declined error
- **Best for**: Testing payment failure

### `webhook_fail` 🔗
- **What it does**: Payment succeeds but webhook processing fails
- **Flow**: Payment completes → Webhook fails → Needs manual reconciliation
- **Best for**: Testing webhook error handling

## Environment Variables

Add these to your `.env` file:

```bash
# Enable mock mode
MOCK_STRIPE_MODE=true

# Choose scenario
MOCK_STRIPE_SCENARIO=success

# JWT is still required
JWT_SECRET=your-secret-key
```

When `MOCK_STRIPE_MODE=true`, these Stripe variables are **NOT** required:
- ~~STRIPE_SECRET_KEY~~
- ~~STRIPE_WEBHOOK_SECRET~~
- ~~STRIPE_MONTHLY_PRICE_ID~~

## Manual Setup (Alternative)

Instead of using the interactive script, you can manually set environment variables:

### Success Test
```bash
MOCK_STRIPE_MODE=true MOCK_STRIPE_SCENARIO=success npm run dev
```

### Cancel Test
```bash
MOCK_STRIPE_MODE=true MOCK_STRIPE_SCENARIO=cancel npm run dev
```

### Invalid Card Test
```bash
MOCK_STRIPE_MODE=true MOCK_STRIPE_SCENARIO=invalid_card npm run dev
```

## What Pages Will You See?

### Success Flow
1. **Payment Page** (http://localhost:8790/payment)
   - Shows JWT status indicator
   - Three subscription plan options

2. **Mock Stripe Checkout** (auto-opens)
   - Looks like Stripe's checkout
   - Shows scenario description
   - Auto-redirects in 5 seconds (for success)

3. **Success Page** (http://localhost:8790/payment?status=success)
   - Confirmation message
   - Order details
   - Session information

### Cancel Flow
1. Payment Page
2. Mock Stripe Checkout
3. Click "Cancel" button
4. **Cancel Page** (http://localhost:8790/payment?status=cancel)

## Troubleshooting

### "Missing required environment variable: STRIPE_SECRET_KEY"
- Make sure `MOCK_STRIPE_MODE=true` is set
- Restart the server after setting environment variables

### JWT Modal Doesn't Appear
- Check browser console for errors
- Make sure `frontend/app.js` is loaded correctly

### Mock Checkout Page Doesn't Load
- Make sure `MOCK_STRIPE_MODE=true` is set
- The `/mock-stripe/checkout` route is only registered in mock mode

## Switching to Real Stripe

When you're ready to test with real Stripe:

```bash
export MOCK_STRIPE_MODE=false
export STRIPE_SECRET_KEY=sk_test_...
export STRIPE_WEBHOOK_SECRET=whsec_...
export STRIPE_MONTHLY_PRICE_ID=price_...
```

Or just choose option `6` from the interactive script!

## Tips

1. **Keep the JWT**: The JWT is stored in localStorage, so you only need to enter it once
2. **Clear JWT**: Use the "Clear JWT" button to test with a different token
3. **Check Console**: Both frontend and backend logs show detailed flow information
4. **Test Multiple Scenarios**: Switch between scenarios to test different edge cases

## Files Involved

- `src/lib/mock-stripe.ts` - Mock Stripe manager implementation
- `frontend/mock-checkout.html` - Mock Stripe checkout page
- `scripts/mock-stripe-interactive.js` - Interactive scenario selector
- `src/server.ts` - Server configuration for mock mode

---

Happy testing! 🎉


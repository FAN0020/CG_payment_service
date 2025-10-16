# ClassGuru Payment Demo

This demo provides a complete, production-ready payment frontend following ClassGuru's design system guidelines.

## Features

✅ **Two Payment Plans**
- **Trial Plan**: $1 USD for 2-day access
- **Monthly Plan**: $12.90 USD/month recurring

✅ **Complete User Journey**
- Payment selection page
- Success page with order details
- Cancel page with retry options

✅ **Design System Compliance**
- Follows ClassGuru UI guidelines (see `classguru_ui_src/`)
- Glassmorphism effects
- Proper spacing (≥24px card radius, 16px button radius)
- Responsive design (mobile-first)
- Accessibility features (keyboard navigation, reduced motion)

✅ **Enhanced Logging**
- Clear console logs for debugging
- Step-by-step payment flow tracking
- Backend request/response logging

## File Structure

```
demo/
├── index.html       # Payment plan selection page
├── success.html     # Payment success page
├── cancel.html      # Payment cancelled page
├── styles.css       # Complete design system styles
├── app.js           # Payment page logic
├── result.js        # Success/cancel page logic
└── README.md        # This file
```

## Setup

### 1. Configure Environment Variables

Copy `env.example` to `.env` and configure:

```bash
# Required Stripe Configuration
STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET_HERE

# Product Price IDs (from Stripe Dashboard)
STRIPE_TRIAL_PRICE_ID=price_YOUR_TRIAL_PRICE_ID
STRIPE_MONTHLY_PRICE_ID=price_YOUR_MONTHLY_PRICE_ID

# JWT for authentication
JWT_SECRET=your-secret-key-here

# Redirect URLs (already configured for demo)
FRONTEND_SUCCESS_URL=http://localhost:8790/payment/success
FRONTEND_CANCEL_URL=http://localhost:8790/payment/cancel
```

### 2. Create Stripe Products

1. Go to [Stripe Dashboard → Products](https://dashboard.stripe.com/test/products)
2. Create two products:

**Trial Plan:**
- Name: "ClassGuru Trial"
- Price: $1.00 USD
- Type: One-time payment (or recurring for 2 days)
- Copy the Price ID → `STRIPE_TRIAL_PRICE_ID`

**Monthly Plan:**
- Name: "ClassGuru Monthly"
- Price: $12.90 USD
- Type: Recurring monthly
- Copy the Price ID → `STRIPE_MONTHLY_PRICE_ID`

### 3. Generate Test JWT

```bash
npm run generate-jwt
```

This will generate a test JWT token. When prompted on the payment page, paste this token.

### 4. Run the Demo

```bash
npm run dev
```

Then open: http://localhost:8790/payment

## Usage Flow

### 1. **Select a Plan**
   - Choose between Trial ($1) or Monthly ($12.90)
   - Click the payment button

### 2. **Enter JWT Token** (First Time)
   - On first use, you'll be prompted for a JWT
   - Use the token from `npm run generate-jwt`
   - Token is stored in localStorage for subsequent uses

### 3. **Complete Payment**
   - Redirected to Stripe Checkout
   - Use test card: `4242 4242 4242 4242`
   - Any future expiry date
   - Any 3-digit CVC

### 4. **View Result**
   - **Success**: See order details and confirmation
   - **Cancel**: Option to retry or contact support

## Console Logging

The demo includes comprehensive logging:

### Frontend Logs
```
================================================================================
ClassGuru Payment Demo - Frontend Initialized
================================================================================
API Base URL: http://localhost:8790
Payment Endpoint: http://localhost:8790/api/payment/create-subscription
================================================================================

[INIT] Found 2 payment buttons
  [1] trial-plan button attached
  [2] monthly-plan button attached
[INIT] ClassGuru Payment Page Ready!
```

### Payment Flow Logs
```
================================================================================
[PAYMENT] Initiating payment for: monthly-plan
================================================================================
[PAYMENT] Request Payload:
  Product ID: monthly-plan
  Currency: USD
  Platform: web
  Idempotency Key: a1b2c3d4...

[PAYMENT] Sending request to: http://localhost:8790/api/payment/create-subscription
[PAYMENT] Response received in 245ms
[SUCCESS] Checkout session created!
  Order ID: order_abc123xyz
  Session ID: cs_test_a1b2c3d4...
  Checkout URL: https://checkout.stripe.com/c/pay/...
```

### Backend Logs
The server logs all steps:
```
[INFO] Create subscription request { requestId, userId, productId, currency }
[DEBUG] Step 1: Starting idempotency check
[DEBUG] Step 2: Idempotency check complete
[DEBUG] Step 3: Creating order via internal handler
[DEBUG] Step 4: Order created, orderId: order_...
[DEBUG] Step 5: Idempotency recorded
[DEBUG] Step 6: Stripe session created
[DEBUG] Step 7: Order updated with session ID
```

## Testing Stripe Integration

### Test Card Numbers

| Card Number | Result |
|------------|--------|
| 4242 4242 4242 4242 | Success |
| 4000 0025 0000 3155 | Requires authentication (3D Secure) |
| 4000 0000 0000 9995 | Declined |

### Webhook Testing

For local development, use Stripe CLI:

```bash
stripe listen --forward-to localhost:8790/webhooks/stripe
```

Copy the webhook signing secret to `.env`:
```
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Design System Details

### Colors
- **Primary**: `#2563EB` (Blue)
- **Accent**: `#22D3EE` (Cyan)
- **Success**: `#16A34A` (Green)
- **Warning**: `#F59E0B` (Orange)
- **Danger**: `#EF4444` (Red)

### Spacing
- Uses 8px grid system
- Card padding: 32-40px
- Button padding: 18px vertical
- Gaps: 16-32px

### Borders
- Cards: ≥24px radius
- Buttons: 16px radius
- Inputs: 12px radius

### Interactions
- Hover: Subtle lift (≤6px for cards, ≤3px for buttons)
- Transitions: 300ms+ to avoid dizziness
- Focus: 2px outline, 2px offset

## Customization

### Adding New Plans

1. **Update Product Config** (`src/config/products.ts`):
```typescript
'premium-plan': {
  priceId: process.env.STRIPE_PREMIUM_PRICE_ID || '',
  amount: 29.90,
  currency: 'USD',
  name: 'Premium Plan',
  description: 'For power users',
  features: ['Feature 1', 'Feature 2']
}
```

2. **Add to Environment** (`.env`):
```bash
STRIPE_PREMIUM_PRICE_ID=price_your_premium_price_id
```

3. **Add to Frontend** (`demo/index.html`):
```html
<div class="pricing-card">
  <!-- Copy existing card structure -->
  <button class="cta-button" data-plan="premium-plan" data-amount="29.90" data-currency="USD">
    Subscribe Now
  </button>
</div>
```

That's it! The system is designed for easy extensibility.

## Troubleshooting

### "Authentication required" error
- Run `npm run generate-jwt` to get a valid token
- Clear localStorage and retry

### "Product configuration not found"
- Check `.env` has the correct `STRIPE_*_PRICE_ID` values
- Restart the server after changing `.env`

### Stripe checkout fails
- Verify Stripe keys are in test mode
- Check webhook secret is correct
- Ensure products exist in Stripe Dashboard

### Styling issues
- Hard refresh (Cmd+Shift+R / Ctrl+Shift+F5)
- Check browser console for CSS errors
- Verify `styles.css` is loading

## Support

For issues or questions:
- Check server logs: `logs/server.log`
- Check browser console (F12)
- Review Stripe Dashboard → Logs
- Contact: support@classguru.ai


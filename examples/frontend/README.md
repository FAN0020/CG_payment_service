# ClassGuru Payment Frontend

A standalone payment page for ClassGuru subscription plans, built following ClassGuru UI design guidelines.

## Overview

This frontend provides a beautiful, accessible payment interface for users to select and purchase ClassGuru subscription plans. The page is served directly from the payment service and integrates seamlessly with the Stripe payment flow.

## Features

- **Two Pricing Plans**:
  - **Trial Plan**: $1 for 2 days access
  - **Monthly Plan**: $12.90/month (featured plan)

- **Design Standards**:
  - Follows ClassGuru UI design guidelines
  - Responsive layout (mobile-first)
  - Glassmorphism effects
  - Smooth animations and transitions
  - Accessibility (A11y) compliant

- **Security**:
  - JWT authentication
  - Idempotency keys for duplicate prevention
  - Secure Stripe checkout integration

## File Structure

```
frontend/
├── index.html       # Main payment page with embedded styles
├── app.js           # Payment logic and API integration
└── README.md        # This file
```

## How It Works

### 1. User Flow

1. User visits `/payment` endpoint
2. User selects a plan (Trial or Monthly)
3. Clicks "Start Trial" or "Get Started" button
4. Frontend generates idempotency key (UUID v4)
5. Calls `/api/payment/create-subscription` with JWT
6. Receives Stripe Checkout URL
7. Redirects user to Stripe for payment
8. After payment, Stripe redirects back to success/cancel URL

### 2. Integration Points

#### API Endpoint
```
POST /api/payment/create-subscription
```

**Request Body**:
```json
{
  "jwt": "user_jwt_token",
  "idempotency_key": "uuid-v4",
  "product_id": "trial-plan" | "monthly-plan",
  "currency": "USD",
  "platform": "web",
  "client_ref": "payment_page_v1"
}
```

**Response**:
```json
{
  "status_code": 200,
  "message": "Checkout session created successfully",
  "data": {
    "checkout_url": "https://checkout.stripe.com/...",
    "order_id": "order_...",
    "session_id": "cs_..."
  }
}
```

### 3. JWT Authentication

The frontend requires a valid JWT token for authentication. In production, this should come from your main authentication system.

**JWT Payload Structure**:
```json
{
  "sub": "user_id",
  "iss": "mainline",
  "iat": 1234567890,
  "exp": 1234567890,
  "email": "user@example.com" // optional
}
```

## Configuration

### Environment Variables (Backend)

Update `.env` in `CG_payment_service/`:

```bash
# Stripe Product Configuration
STRIPE_TRIAL_PRICE_ID=price_your_trial_price_id_here
STRIPE_MONTHLY_PRICE_ID=price_your_monthly_price_id_here

# Frontend URLs (where to redirect after payment)
FRONTEND_SUCCESS_URL=http://localhost:8790/payment?status=success
FRONTEND_CANCEL_URL=http://localhost:8790/payment?status=cancel
```

### Stripe Setup

1. Create products in Stripe Dashboard:
   - **Trial Plan**: $1 USD, one-time payment or 2-day subscription
   - **Monthly Plan**: $12.90 USD, recurring monthly

2. Copy the Price IDs to your `.env` file

## Development

### Running Locally

1. Start the payment service:
   ```bash
   cd CG_payment_service
   npm run dev
   ```

2. Visit the payment page:
   ```
   http://localhost:8790/payment
   ```

### Testing

**Demo Mode**:
The frontend includes a demo mode for testing. When no JWT is found, it will prompt you to enter one.

**With Real JWT**:
1. Generate a JWT from your authentication system
2. Store it in localStorage as `cg_demo_jwt`
3. Refresh the page

**Stripe Test Mode**:
Use Stripe test credit cards:
- Success: `4242 4242 4242 4242`
- Requires Auth: `4000 0025 0000 3155`
- Declined: `4000 0000 0000 9995`

## Design Guidelines Compliance

This frontend follows ClassGuru's design standards:

### ✅ Visual
- Border radius: Cards ≥ 24px, Buttons 16px
- Padding: Cards 32px, responsive on mobile
- Glassmorphism: `backdrop-blur` + semi-transparent backgrounds
- Colors: Primary (#3358ff), Accent (#22d3ee), defined in CSS variables

### ✅ Layout
- Max width: 1152px (6xl)
- Responsive grid: Auto-fit, min 320px columns
- Spacing: Consistent 32px gaps

### ✅ Interactions
- Hover effects: Subtle lift (≤8px) with shadow enhancement
- Button states: Primary gradient, secondary outlined
- Loading states: Spinner with disable state
- Error feedback: Inline error messages

### ✅ Accessibility
- Keyboard navigation supported
- Focus visible on interactive elements
- Semantic HTML (`<button>`, not `<div>`)
- ARIA labels where needed
- Reduced motion support via `@media (prefers-reduced-motion)`

## Customization

### Adding New Plans

1. **Backend** (`src/routes/payment.ts`):
   ```typescript
   const PRODUCT_CONFIG = {
     'new-plan': { 
       priceId: process.env.STRIPE_NEW_PRICE_ID, 
       amount: 29.90, 
       currency: 'USD' 
     }
   }
   ```

2. **Types** (`src/types/index.ts`):
   ```typescript
   const ALLOWED_PRODUCTS = ['trial-plan', 'monthly-plan', 'new-plan']
   ```

3. **Frontend** (`frontend/index.html`):
   Add a new pricing card with the plan details

### Styling

All styles are in `index.html` using CSS variables. To customize:

1. Update CSS variables in `:root` selector
2. Modify component classes (`.pricing-card`, `.cta-button`, etc.)
3. Maintain design consistency with ClassGuru guidelines

## Production Deployment

### Checklist

- [ ] Set up real Stripe products and prices
- [ ] Update `.env` with production Stripe keys
- [ ] Configure success/cancel URLs to your domain
- [ ] Implement proper JWT authentication flow
- [ ] Set CORS to restrict origins
- [ ] Enable HTTPS
- [ ] Test all payment flows
- [ ] Monitor with error tracking (Sentry, etc.)

### Security Notes

1. **Never** expose Stripe secret keys in frontend code
2. Always validate JWT tokens on the backend
3. Use HTTPS in production
4. Implement rate limiting for payment endpoints
5. Monitor for suspicious payment patterns

## Troubleshooting

### "Authentication required" error
- Ensure you have a valid JWT token
- Check JWT_SECRET matches between services
- Verify JWT hasn't expired

### "Payment initiation failed"
- Check Stripe API keys are correct
- Verify Price IDs match your Stripe products
- Check browser console for detailed error messages

### Page not loading
- Ensure payment service is running on port 8790
- Check `/api/payment/health` endpoint
- Verify `frontend/` directory exists in `CG_payment_service/`

## Future Enhancements

Potential improvements:

- [ ] Add annual plan option
- [ ] Implement coupon code support
- [ ] Add payment history view
- [ ] Support multiple currencies
- [ ] Add subscription management page
- [ ] Implement plan upgrade/downgrade flows

## License

© 2025 ClassGuru. All rights reserved.


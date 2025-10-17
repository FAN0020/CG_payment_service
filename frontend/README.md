# ClassGuru Payment Frontend

Production-ready payment interface following ClassGuru's design system.

## Features

- Two payment plans: Trial ($1 for 2 days) and Monthly ($12.90/month)
- Complete user journey: selection → success/cancel pages
- Glassmorphism design with responsive layout
- Accessible (keyboard navigation, reduced motion support)

## Setup

### 1. Configure Stripe Products

1. Go to [Stripe Dashboard → Products](https://dashboard.stripe.com/test/products)
2. Create two products:
   - **Trial**: $1.00 USD one-time
   - **Monthly**: $12.90 USD recurring monthly
3. Add Price IDs to `.env`:
   ```
   STRIPE_TRIAL_PRICE_ID=price_your_trial_price_id
   STRIPE_MONTHLY_PRICE_ID=price_your_monthly_price_id
   ```

### 2. Generate Test JWT

```bash
npm run generate-jwt
```

### 3. Test Payment Flow

```bash
npm start
open http://localhost:8790/payment
```

Use test card: `4242 4242 4242 4242`

## File Structure

```
frontend/
├── index.html       # Payment plan selection
├── success.html     # Payment success page
├── cancel.html      # Payment cancelled page
├── styles.css       # Design system styles
├── app.js           # Payment page logic
└── result.js        # Success/cancel page logic
```

## Design System

### Colors
- Primary: `#2563EB` (Blue)
- Accent: `#22D3EE` (Cyan)
- Success: `#16A34A` | Warning: `#F59E0B` | Danger: `#EF4444`

### Spacing & Borders
- Card radius: ≥24px | Button radius: 16px
- Card padding: 32-40px | Button padding: 18px vertical
- Uses 8px grid system

### Interactions
- Hover lift: ≤6px for cards, ≤3px for buttons
- Transitions: 300ms+ ease
- Focus: 2px outline with 2px offset

## Adding New Plans

1. **Update `src/config/products.ts`:**
   ```typescript
   'premium-plan': {
     priceId: process.env.STRIPE_PREMIUM_PRICE_ID || '',
     amount: 29.90,
     currency: 'USD',
     name: 'Premium Plan',
     description: 'For power users'
   }
   ```

2. **Add to `.env`:**
   ```
   STRIPE_PREMIUM_PRICE_ID=price_...
   ```

3. **Add button to `index.html`:**
   ```html
   <button class="cta-button" data-plan="premium-plan" data-amount="29.90" data-currency="USD">
     Subscribe Now
   </button>
   ```

## Troubleshooting

**Authentication required error**
- Run `npm run generate-jwt` for a valid token
- Clear localStorage and retry

**Product configuration not found**
- Verify `.env` has correct `STRIPE_*_PRICE_ID` values
- Restart server after changing `.env`

**Stripe checkout fails**
- Verify keys are in test mode (`sk_test_...`)
- Check webhook secret is correct
- Ensure products exist in Stripe Dashboard

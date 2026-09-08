# ClassGuru Payment Service

A standalone TypeScript/Fastify service for subscription billing and credit management in ClassGuruAI, an education product.

## Project context

Developed as part of the ClassGuruAI team for the Chunhui Cup Innovation & Entrepreneurship Competition. My contribution focused on the payment microservice, connecting subscription checkout with authentication, persistent order state, and credit-management APIs.

## Engineering highlights

- **Subscription billing:** Stripe checkout and signature-verified webhooks, with event tracking to handle repeated notifications.
- **Application integration:** JWT authentication and APIs for subscription and credit-management workflows.
- **Data and concurrency:** SQLite in WAL mode, persistent orders, and request-idempotency records.
- **Delivery tooling:** Docker Compose configuration, health checks, Makefile commands, structured logging, and OpenAPI documentation.

**Stack:** TypeScript · Fastify · Stripe · SQLite · JWT · Docker

Explore the [API specification](docs/openapi.yaml), [integration guide](docs/integration-guide.md), and [Docker guide](docs/DOCKER.md).

## 🚀 Quick Start

### Setup
```bash
# 1. Install dependencies
npm install

# 2. Configure environment
# Create .env using the Required Environment Variables section below
# Add your Stripe test keys and JWT secret

# 3. Validate configuration
npm run validate
```

### Start Server
```bash
# Simple start
npm start

# Or using Make
make start

# Development mode (watch)
make start-dev
```

### Test Payment Flow
```bash
# Generate test JWT
npm run generate-jwt

# Open payment page
open http://localhost:8790/payment
```

## 📋 What's Included

- **TypeScript codebase** with Fastify API routes and a separate frontend
- **Stripe integration** with webhooks and idempotency
- **SQLite database** for order and subscription tracking
- **Development tooling** (Makefile, validation scripts, health checks)
- **Modern frontend** following ClassGuru design system
- **Test utilities** for integration scenarios, concurrent checkout, and webhooks

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│         Payment Service (Port 8790)         │
├─────────────────────────────────────────────┤
│                                             │
│  Frontend Pages                             │
│  ├─ /payment (plan selection)              │
│  ├─ /payment/success                        │
│  └─ /payment/cancel                         │
│                                             │
│  API Routes (JWT authenticated)             │
│  ├─ POST /api/payment/create-subscription  │
│  ├─ POST /api/payment/verify-subscription  │
│  └─ GET  /api/payment/health                │
│                                             │
│  Webhook Routes (Stripe verified)           │
│  └─ POST /webhooks/stripe                   │
│                                             │
│  Internal Handlers                          │
│  ├─ create-order                            │
│  ├─ update-subscription                     │
│  └─ query-subscription                      │
│                                             │
│  Data Layer (SQLite)                        │
│  └─ subscription_orders, events             │
│                                             │
└─────────────────────────────────────────────┘
```

## 🛠️ Available Commands

### Make Commands
```bash
make help         # Show all commands
make start        # Start server (validates first)
make stop         # Stop server
make restart      # Restart server
make status       # Check if running
make health       # Health check
make validate     # Validate environment
make clean        # Clean database
```

### NPM Scripts
```bash
npm run validate      # Validate .env configuration
npm run generate-jwt  # Generate test JWT token
npm run kill-server   # Kill existing server
```

## 💳 Payment Plans

- **Daily Plan**: S$1.99 SGD/day recurring
- **Weekly Plan**: S$9.90 SGD/week recurring  
- **Monthly Plan**: S$14.90 SGD/month recurring

### Test Cards
- **Success**: `4242 4242 4242 4242`
- **3D Secure**: `4000 0025 0000 3155`
- **Declined**: `4000 0000 0000 9995`

## 🔧 Configuration

### Required Environment Variables
```env
# Server
PORT=8790

# Stripe (use test keys for development)
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_secret_here
STRIPE_DAILY_PRICE_ID=price_your_daily_price_id
STRIPE_WEEKLY_PRICE_ID=price_your_weekly_price_id
STRIPE_MONTHLY_PRICE_ID=price_your_monthly_price_id

# JWT (MUST match mainline config)
JWT_SECRET=your_shared_secret_at_least_32_characters

# Database
DB_PATH=./data/payment.db
```

### Stripe Setup
1. Create account at [stripe.com](https://stripe.com)
2. Go to **Dashboard → Products** → Create products:
   - Daily Plan: S$1.99 recurring daily
   - Weekly Plan: S$9.90 recurring weekly
   - Monthly Plan: S$14.90 recurring monthly
3. Copy Price IDs to `.env`
4. For webhooks: `stripe listen --forward-to localhost:8790/webhooks/stripe`

## 📊 API Reference

### Endpoints
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/payment/health` | GET | None | Health check |
| `/api/payment/create-subscription` | POST | JWT | Create checkout session |
| `/api/payment/verify-subscription` | POST | JWT | Check subscription status |
| `/webhooks/stripe` | POST | Stripe Signature | Webhook handler |

### JWT Payload Structure
```typescript
{
  "sub": "user-123456",           // User ID (required)
  "iss": "mainline",              // Issuer (required)
  "iat": 1699999000,              // Issued at (required)
  "exp": 1700000000,              // Expiration (required)
  "email": "user@example.com"     // Email (optional)
}
```

## 🧪 Validation and Test Utilities

The repository defines TypeScript validation commands:

```bash
npm run type-check
npm run build
```

Additional test utilities are available in [tests/integration](tests/integration), [scripts/test-concurrent-checkout.js](scripts/test-concurrent-checkout.js), and [scripts/test-webhooks.js](scripts/test-webhooks.js). Consult each script for its configuration and service requirements. Record the environment and command output when reporting results.

## 🔍 Troubleshooting

### Common Issues

**Port Already in Use**
```bash
make stop
# or
npm run kill-server
```

**Environment Validation Fails**
```bash
npm run validate
# Fix .env file, then validate again
```

**Server Not Responding**
```bash
make status
make health
# If still issues: make restart
```

### Debug Commands
```bash
# Check server status
make status

# View database
sqlite3 data/payment.db "SELECT * FROM subscription_orders;"

# Test health endpoint
curl http://localhost:8790/api/payment/health
```

## 📁 Project Structure

```
CG_payment_service/
├── src/
│   ├── server.ts                 # Main entry point
│   ├── lib/                      # Infrastructure
│   │   ├── database.ts           # SQLite manager
│   │   ├── stripe.ts             # Stripe API
│   │   ├── jwt.ts                # JWT verification
│   │   └── logger.ts             # Logging
│   ├── handlers/                 # Business logic
│   │   ├── create-order.ts
│   │   ├── update-subscription.ts
│   │   └── query-subscription.ts
│   ├── routes/                   # API endpoints
│   │   ├── payment.ts
│   │   └── webhook.ts
│   └── config/
│       └── products.ts           # Product catalog
├── frontend/                     # Frontend pages
│   ├── index.html               # Payment selection
│   ├── success.html             # Success page
│   ├── cancel.html              # Cancel page
│   ├── app.js                   # Payment logic
│   ├── result.js                # Result page logic
│   └── styles.css               # Design system
├── scripts/                     # Automation
│   ├── validate-env.js
│   └── generate-test-jwt.js
├── docs/
│   ├── openapi.yaml             # API specification
│   └── DOCKER.md                # Docker configuration guide
├── Makefile                     # Professional commands
└── README.md                    # This file
```

## 🐳 Docker Deployment

### Quick Docker Start
```bash
# Build and run with Docker Compose
cd docker
docker compose up -d

# Verify deployment
curl http://localhost:8790/api/credits/health
```

**📖 Complete Docker Guide**: See [docs/DOCKER.md](docs/DOCKER.md) for detailed Docker configuration, volume management, security settings, and production deployment instructions.

## 🚀 Production Deployment

### Pre-Deployment Checklist
- [x] Remove mock Stripe code
- [x] Setup real Stripe integration structure
- [x] Docker configuration ready
- [ ] Configure your Stripe keys in .env
- [ ] Switch to live Stripe keys (`sk_live_...`) for production
- [ ] Create live products and update Price IDs
- [ ] Configure production webhook in Stripe Dashboard
- [ ] Use 64+ character random JWT secret
- [ ] Enable HTTPS/TLS
- [ ] Set up monitoring and alerts

### Production Environment
```env
PORT=8790
STRIPE_SECRET_KEY=sk_live_your_production_key
STRIPE_WEBHOOK_SECRET=whsec_your_production_secret
JWT_SECRET=64_character_random_string_here
FRONTEND_SUCCESS_URL=https://classguru.com/payment/success
FRONTEND_CANCEL_URL=https://classguru.com/payment/cancel
```

## 📞 Support

- **Stripe Docs**: [stripe.com/docs](https://stripe.com/docs)
- **Test Cards**: [stripe.com/docs/testing](https://stripe.com/docs/testing)
- **Issues**: Check server logs and browser console

---

**Built with**: TypeScript, Fastify, Stripe, SQLite, JWT  
**Documentation updated**: September 2026

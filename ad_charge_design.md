# 🧩 Ad Service Design Report (v1.1)

**Author:** Fan Yupei
**Scope:** PWA-based Ad Service with Click-Driven Revenue and Credits Integration
**Version:** v1.1
**Date:** October 2025

---

## 1. Overview

This document describes the design and implementation plan for a **click-driven Ad Service** integrated with a **Payment/Credits system**, allowing Google Ads and third-party ad providers (e.g., mini-game or shopping redirects) to be served inside a PWA (Progressive Web App) environment. Version 1.1 adds a modular provider architecture, dynamic configuration, anti‑abuse controls, normalized responses, and revenue ingestion scaffolding.

The primary goal is to unify different ad monetisation models — **per-click (CPC)**, **per-impression (CPM)**, and **external redirects** — under one consistent API, with integrated credit accounting and support for multiple providers.

---

## 2. Objectives

| Goal                           | Description                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------- |
| Unified ad logic               | Treat Google Ads and other click-based offers under one common Ad Service interface.         |
| Click-based monetisation       | Each valid user click (redirect to ad landing page) triggers billing or reward logic.        |
| Integration with credits       | Ad interactions map to credit deduction or reward, depending on user role (free/premium).    |
| Extensible microservice design | Support pluggable “ad providers” (Google, affiliate, shopping, mini-games).                  |
| Environment-configurable       | Use environment variables (`AD_CREDIT_RATIO`, `CREDIT_CONVERSION_PARAM`) for runtime tuning. |
| PWA compatibility              | Fully functional within service-worker-based PWA, without native SDKs.                       |

---

## 3. System Architecture

### 3.1 Service Overview

```
┌──────────────────────────────┐
│        Mainline App          │
│  (PWA Frontend / Gateway)    │
└─────────────┬────────────────┘
              │ JWT Auth
              ▼
┌──────────────────────────────┐
│        Ad Service            │
│ - Request/Display/Click APIs │
│ - Provider Adapters          │
│ - Credits Integration        │
│ - Anti-Abuse Controls        │
│ - Revenue Ingestion          │
└───────┬─────────┬────────────┘
        │         │
        │         ▼
        │   Payment/Credits Service
        │   - Manage user credits
        │   - Premium status
        │   - Idempotent transactions
        │
        ▼
  External Ad Networks
  (Google Ads API / Affiliate APIs / Mini-game redirects)
```

### 3.2 Core Components

| Component                   | Responsibility                                                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ad Service**              | Main backend handling ad request, display, click events, provider selection, and data aggregation.                                                      |
| **Provider Adapters**       | Abstraction layer for multiple ad sources (Google Ads, affiliate networks, etc.). Each adapter implements `requestAd()`, `onClick()`, optional `onReward()`, and optional revenue hooks. |
| **Credits/Payment Service** | Manages credits, rewards, and premium validation via REST API.                                                                                          |
| **Auth Service**            | JWT verification and user identification.                                                                                                               |
| **Database**                | Tracks ad impressions, clicks, and provider performance (`ad_requests`, `ad_clicks`, `ad_providers`, `ad_events`).                                      |

---

## 4. Workflow

### 4.1 Ad Request Flow

1. **Frontend (PWA)** sends `POST /api/ads/request` (JWT optional).
2. **Ad Service** verifies JWT (if provided) and fetches user info.
3. Ad Service checks credits and premium status via `Payment/Credits Service`.
4. Based on configuration and provider pool, the Ad Service selects an ad provider (e.g., GoogleAdsAdapter, AffiliateClickAdapter).
5. Returns ad metadata (`adId`, `redirectUrl`, `provider`, `rewardType`, `impressionId`, `viewabilityToken`) to frontend.

---

### 4.2 Click Event Flow

1. User clicks ad → frontend triggers `POST /api/ads/click` with `adId`.

2. Ad Service validates `viewabilityToken`, dedupes click, records event, checks provider type:

   * **If credits-based:** reward or deduct via `/api/credits/reward` or `/api/credits/deduct`.
   * **If external revenue-based:** record click only; revenue fetched later from provider API.

3. Response normalized:

   ```json
   { "success": true, "data": { "adId": "123", "creditsAwarded": 1 }, "requestId": "uuid" }
   ```

4. (Optional) Scheduled job aggregates click data into provider-level metrics for revenue estimation.

---

## 5. API Specification

### 5.1 Ad Service APIs

| Method | Endpoint           | Description                                       | Auth         |
| ------ | ------------------ | ------------------------------------------------- | ------------ |
| `POST` | `/api/ads/request` | Request a new ad (provider chosen automatically). | Optional JWT |
| `POST` | `/api/ads/click`   | Record user click, dedupe/validate, trigger credit update. | Optional JWT |
| `GET`  | `/api/ads/metrics` | Admin report of ad/click statistics.              | Admin JWT    |
| `GET`  | `/api/ads/health`  | Health check endpoint.                            | Public       |

### 5.2 Provider Adapter Interface

```ts
interface ProviderContext {
  userId?: string;
  sessionId: string;
  page: string;
  deviceType?: 'desktop' | 'mobile' | 'tablet';
}

interface ClickContext {
  adId: string;
  impressionId: string;
  userId?: string;
  clickUrl?: string;
}

interface AdProvider {
  name: 'google' | 'affiliate' | 'minigame' | string;
  requestAd(ctx: ProviderContext): Promise<AdObject>;
  onClick(ctx: ClickContext): Promise<ClickResult>;
  onReward?(ctx: ClickContext): Promise<RewardResult>;
  fetchRevenue?(start: Date, end: Date): Promise<RevenueBatch[]>;
}
```

Provider selection strategies: `round_robin`, `weighted_random`, `rules_based` (device/page).

### 5.3 Credits Service Integration

* `/api/credits/status` → `{ credits_balance, is_premium, can_skip_ads }`
* `/api/credits/reward` → reward credits after valid click
* `/api/credits/deduct` → deduct credits when skipping ads

All calls authenticated via `Authorization: Bearer <jwt>`.

---

## 6. Environment Configuration

| Variable                  | Purpose                                                                    |
| ------------------------- | -------------------------------------------------------------------------- |
| `AD_CREDIT_RATIO`         | Ratio of ad click → credit conversion. Example: 1 click = 1 credit reward. |
| `CREDIT_CONVERSION_PARAM` | Adjustable coefficient to tune reward/payout across providers.             |
| `CREDITS_ON_CLICK_ENABLED`| Toggle for awarding credits on click.                                      |
| `GOOGLE_AD_CLIENT_ID`     | Your AdSense / Ad Manager client ID.                                       |
| `AFFILIATE_API_KEY`       | Token for third-party ad networks.                                         |
| `AFFILIATE_BASE_URL`      | Base API URL for affiliate provider.                                       |
| `PROVIDER_LIST`           | Comma-separated active providers (e.g. `google,affiliate,games`).          |
| `PROVIDER_WEIGHTS`        | Weighted selection, e.g. `google:70,affiliate:20,minigame:10`.             |
| `ADS_FEATURE_FLAGS`       | CSV feature flags: `dedupe,rate_limit,min_display_ms`.                     |
| `AD_MIN_DISPLAY_MS`       | Minimum display time before a click is valid.                              |
| `CLICK_RATE_LIMIT`        | Rate limit, e.g. `20/min`.                                                 |
| `CLICK_DEDUPE_WINDOW_MS`  | Deduplication window in milliseconds.                                      |
| `SYNC_REVENUE_CRON`       | Cron for revenue sync (e.g., hourly).                                      |
| `CONFIG_VARIANT`          | A/B variant label (e.g., `A`, `B`).                                        |
| `FEATURE_ROLLOUT`         | Feature rollout ratios, e.g., `provider_selection:50`.                     |

> All variables are loaded from `.env` and injected during deployment to allow A/B testing and dynamic parameter tuning.

---

## 7. Security & Anti-Abuse Measures

* **JWT-based user tracking** ensures each click is bound to a verified identity (JWT `iss`, `exp` validated).
* **Click de-duplication**: repeated clicks on same ad within short time window are ignored.
* **IP/User-Agent fingerprinting**: used to detect bot traffic or fraud.
* **Minimum display-time enforcement** using a signed `viewabilityToken`.
* **Rate limiting** on `/api/ads/click` to prevent abuse.
* **Server-side structured logging** (with `requestId`, `provider`, `userId`, and timestamps) for audit and revenue verification.

---

## 8. Integration with External Providers

| Provider Type                                            | Integration Method                                                                                                                                         | Notes                                                                            |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Google Ads / AdSense**                                 | Embed Google Publisher Tag (GPT) script in frontend; use Ad Manager to manage CPC ads. Backend only logs events and correlates via Google Ads API reports. | Fully compatible with PWA; must comply with Google Ads policy.                   |
| **Affiliate / Shopping Offers (e.g., Trip.com, Shopee)** | Integrate via affiliate SDKs or REST APIs; typically provide deep links or banner ads with tracking parameters (`?affid=...`).                             | Best for click-redirect revenue. Must manage callback tracking to confirm click. |
| **Mini-Game / Reward Networks**                          | Use HTML5 playable ad scripts or web iframe redirect offers. Reward credits once completion callback received.                                             | Feasible in PWA; native SDKs unnecessary.                                        |
| **Custom Internal Ads**                                  | Your own promotional pages or partner ads; direct redirect URLs.                                                                                           | Useful fallback when no external inventory.                                      |

---

## 9. PWA vs Native App Feasibility

| Feature              | PWA                                            | Native App                                        |
| -------------------- | ---------------------------------------------- | ------------------------------------------------- |
| Integration method   | JS tags, HTML redirects                        | Full SDK integration                              |
| Ad formats supported | Banner, interstitial, redirect, HTML5 playable | Rewarded video, interactive game ads, push offers |
| Revenue rate         | Generally lower                                | Higher (better targeting)                         |
| Deployment           | Instant updates via web                        | App store updates required                        |
| Feasibility          | ✅ Fully feasible (for redirect/click ads)      | ✅ More powerful, higher yield                     |

**Conclusion:**
For click-redirect and HTML-based playable ads, **PWA integration is fully feasible** and recommended for early deployment.
Native app integration can be added later for advanced ad formats and mediation.

---

## 10. Data Model (Simplified)

```sql
ALTER TABLE ad_impressions ADD COLUMN provider TEXT DEFAULT 'google';
ALTER TABLE ad_clicks ADD COLUMN provider TEXT DEFAULT 'google';

CREATE TABLE IF NOT EXISTS ad_providers (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  weight INTEGER DEFAULT 100,
  active BOOLEAN DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS provider_revenue_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  date DATE NOT NULL,
  gross_revenue REAL NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  source_ref TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (provider, date)
);
```

---

## 11. Database Schema

### 11.1 Core Tables

```sql
-- Add provider column to existing impressions table
ALTER TABLE ad_impressions ADD COLUMN provider TEXT DEFAULT 'google';
ALTER TABLE ad_impressions ADD COLUMN user_agent TEXT;
ALTER TABLE ad_impressions ADD COLUMN ip_address TEXT;
ALTER TABLE ad_impressions ADD COLUMN fingerprint TEXT;

-- Add provider column to existing clicks table
ALTER TABLE ad_clicks ADD COLUMN provider TEXT DEFAULT 'google';
ALTER TABLE ad_clicks ADD COLUMN credits_awarded INTEGER DEFAULT 0;

-- Provider registry
CREATE TABLE IF NOT EXISTS ad_providers (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  weight INTEGER DEFAULT 100,
  active BOOLEAN DEFAULT 1,
  config_json TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Daily revenue aggregation
CREATE TABLE IF NOT EXISTS provider_revenue_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  date DATE NOT NULL,
  gross_revenue REAL NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  source_ref TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (provider, date)
);

-- Click deduplication tracking (in-memory with TTL)
-- Rate limit tracking (in-memory with TTL)
```

### 11.2 Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_impressions_provider ON ad_impressions(provider);
CREATE INDEX IF NOT EXISTS idx_impressions_timestamp ON ad_impressions(timestamp);
CREATE INDEX IF NOT EXISTS idx_clicks_provider ON ad_clicks(provider);
CREATE INDEX IF NOT EXISTS idx_clicks_timestamp ON ad_clicks(timestamp);
CREATE INDEX IF NOT EXISTS idx_revenue_provider_date ON provider_revenue_daily(provider, date);
```

---

## 12. Module Structure

```
src/
├── types/
│   └── index.ts              # Core type definitions
├── providers/
│   ├── types.ts              # Provider interface definitions
│   ├── registry.ts           # Provider selection and registry
│   ├── google.ts             # Google Ads adapter
│   ├── affiliate.ts          # Affiliate redirect adapter
│   └── minigame.ts           # Mini-game adapter
├── lib/
│   ├── abuse.ts              # Anti-abuse: rate limit, dedupe, viewability
│   ├── fingerprint.ts        # IP/UA fingerprinting
│   ├── api-response.ts       # Normalized API responses
│   ├── database.ts           # Database operations with provider support
│   ├── credits-client.ts     # Credits service integration
│   ├── google-ads.ts         # Google Ads manager (existing)
│   ├── jwt.ts                # JWT utilities (existing)
│   └── logger.ts             # Logger (existing)
├── middleware/
│   └── request-id.ts         # Request ID injection
├── revenue/
│   └── sync.ts               # Revenue sync scheduler
├── config/
│   └── ads.ts                # Environment-based configuration
├── handlers/
│   ├── request-ad.ts         # Ad request handler
│   ├── track-click.ts        # Click tracking handler
│   └── get-metrics.ts        # Metrics handler
├── routes/
│   ├── ads.ts                # Ad API routes
│   └── index.ts              # Route registration
└── server.ts                 # Main server entry point
```

---

## 13. Environment Variables Reference

| Variable                  | Default | Description |
| ------------------------- | ------- | ----------- |
| `PROVIDER_LIST`            | `google` | Comma-separated active providers |
| `PROVIDER_WEIGHTS`         | -       | Weighted selection: `google:70,affiliate:20,minigame:10` |
| `AD_CREDIT_RATIO`          | `1`     | Credits per click |
| `CREDIT_CONVERSION_PARAM`  | `1.0`   | Multiplier for credit calculation |
| `CREDITS_ON_CLICK_ENABLED` | `false` | Enable credits on click |
| `GOOGLE_AD_CLIENT_ID`      | -       | Google AdSense client ID |
| `AFFILIATE_API_KEY`        | -       | Affiliate API key |
| `AFFILIATE_BASE_URL`       | -       | Affiliate provider base URL |
| `ADS_FEATURE_FLAGS`        | -       | CSV: `dedupe,rate_limit,min_display_ms` |
| `AD_MIN_DISPLAY_MS`        | `5000`  | Minimum display time (ms) |
| `CLICK_RATE_LIMIT`         | `20/min` | Rate limit per user/IP |
| `CLICK_DEDUPE_WINDOW_MS`   | `5000`  | Dedupe window (ms) |
| `SYNC_REVENUE_CRON`        | `0 * * * *` | Revenue sync schedule |
| `PAYMENT_SERVICE_BASE_URL` | `http://localhost:8790` | Credits service URL |
| `JWT_SECRET`               | -       | JWT verification secret |
| `DB_PATH`                  | `./data/ad_service.db` | SQLite database path |

---

## 14. Deployment & Rollout Plan

### Phase 1: Core Infrastructure ✅
- ✅ Provider registry and `provider` attribution fields
- ✅ Normalized API responses with `requestId`
- ✅ Request ID middleware

### Phase 2: Anti-Abuse & Security ✅
- ✅ Click deduplication
- ✅ Rate limiting
- ✅ Viewability tokens
- ✅ IP/UA fingerprinting

### Phase 3: Provider Integration ✅
- ✅ Google Ads adapter
- ✅ Affiliate redirect adapter
- ✅ Mini-game adapter
- ✅ Provider selection strategies

### Phase 4: Credits & Revenue ✅
- ✅ Credits-on-click integration
- ✅ Revenue sync scaffolding
- ✅ Provider daily revenue aggregation

### Phase 5: Production Hardening
- Migration to Postgres for high volume
- Queue/event stream (Redis Streams/RabbitMQ)
- Monitoring and alerting
- A/B testing infrastructure
- Performance optimization

---

## 15. API Response Format

All responses follow this normalized structure:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  requestId: string;
}
```

### Error Codes

| Code | Description |
| ---- | ----------- |
| `AD_INTERNAL_ERROR` | Internal server error |
| `AD_IMPRESSION_NOT_FOUND` | Impression ID not found |
| `AD_RATE_LIMITED` | Too many requests |
| `AD_VIEWABILITY_NOT_SATISFIED` | Minimum display time not met |
| `AD_CLICK_DEDUPE` | Duplicate click detected |
| `AD_BAD_REQUEST` | Invalid request parameters |
| `AD_PROVIDER_ERROR` | Provider-specific error |

---

## 16. Production Readiness Checklist

- ✅ Modular provider architecture
- ✅ Anti-abuse controls (rate limit, dedupe, viewability)
- ✅ Normalized API responses
- ✅ Structured logging with request IDs
- ✅ Environment-based configuration
- ✅ Database schema with provider attribution
- ✅ Credits integration
- ✅ Revenue sync infrastructure
- ⏳ Database migration scripts
- ⏳ Comprehensive error handling
- ⏳ Health check endpoints
- ⏳ Monitoring integration
- ⏳ Load testing
- ⏳ Documentation

---

**End of Design Document**

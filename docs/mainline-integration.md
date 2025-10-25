# Payment Service - Mainline Integration API

This document describes the encapsulated payment service API designed for integration with the ClassGuru mainline application.

## Overview

The payment service is now fully encapsulated as an independent microservice that communicates with mainline via JWT-authenticated REST API endpoints. All internal logic (Stripe, database, webhook handling) remains isolated within this service.

## Authentication

All API endpoints (except health check) require JWT bearer token authentication:

```
Authorization: Bearer <jwt_token>
```

### JWT Token Requirements

- **Secret**: Must use the same `JWT_SECRET` as mainline
- **Payload**: Must contain at least `{ sub: userId, iss: "mainline", exp }`
- **Roles**: Optional `roles` array for access control
  - `["user"]` - Normal user access
  - `["admin"]` - Admin access (can query any user's data)

## API Endpoints

### 1. Create Payment Session

**POST** `/api/payments/create-session`

Creates a Stripe checkout session. Mainline sends only `uid`, payment service decides the plan internally.

#### Request Body
```json
{
  "uid": "user-123456",
  "ad_source": "google_ads",      // Optional
  "campaign_id": "summer_promo"   // Optional
}
```

#### Response
```json
{
  "code": 200,
  "message": "Session created",
  "date": "2025-01-22T04:00:00Z",
  "requestId": "req_abcd123",
  "data": {
    "checkoutUrl": "https://checkout.stripe.com/pay/cs_test_...",
    "requestId": "req_abcd123",
    "orderId": "order_xyz789",
    "sessionId": "cs_test_..."
  }
}
```

### 2. Check Payment Status

**GET** `/api/payments/status/{requestId}`

Query payment status using the short-lived request ID returned from create-session.

#### Response
```json
{
  "code": 200,
  "message": "Payment status retrieved",
  "date": "2025-01-22T04:00:00Z",
  "requestId": "req_xyz789",
  "data": {
    "requestId": "req_abcd123",
    "orderId": "order_xyz789",
    "status": "pending",  // "pending", "success", "cancelled", "failed"
    "amount": 9.90,
    "currency": "SGD",
    "plan": "weekly-plan",
    "createdAt": 1733011200000,
    "updatedAt": 1733011200000
  }
}
```

### 3. Admin Query (Admin Only)

**GET** `/api/payments/admin/query/{uid}`

Query all orders for a specific user. Requires admin role.

#### Response
```json
{
  "code": 200,
  "message": "Orders retrieved",
  "date": "2025-01-22T04:00:00Z",
  "requestId": "req_xyz789",
  "data": {
    "uid": "user-123456",
    "orders": [
      {
        "orderId": "order_xyz789",
        "status": "active",
        "plan": "weekly-plan",
        "amount": 9.90,
        "currency": "SGD",
        "createdAt": 1733011200000,
        "updatedAt": 1733011200000,
        "requestId": "req_abcd123",
        "adSource": "google_ads",
        "campaignId": "summer_promo"
      }
    ]
  }
}
```

### 4. Health Check

**GET** `/api/payments/health`

No authentication required.

#### Response
```json
{
  "code": 200,
  "message": "Service healthy",
  "date": "2025-01-22T04:00:00Z",
  "requestId": "req_xyz789",
  "data": {
    "status": "healthy",
    "service": "payment",
    "timestamp": 1733011200000
  }
}
```

## Workflow

1. **Mainline** calls `POST /api/payments/create-session` with `{ uid }` only
2. **Payment Service** creates Stripe checkout session internally and returns `checkoutUrl`
3. **Mainline** redirects user to `checkoutUrl`
4. **Stripe** processes payment and calls webhook
5. **Payment Service** updates database (`status = "active"`)
6. **Mainline** polls `GET /api/payments/status/{requestId}` until status changes to `"success"` or timeout (5 minutes)

## Request ID System

- **Short-lived**: 15-minute TTL
- **Unique**: Generated per payment session
- **Purpose**: Allows mainline to poll payment status without exposing internal order IDs
- **Cleanup**: Expired request IDs are automatically cleaned up every 5 minutes

## Access Control

- **Normal users**: Can only access their own resources (uid must match JWT sub)
- **Admin users**: Can access any user's data via admin endpoints
- **Forbidden**: Users cannot create sessions or query data for other users

## Error Responses

All endpoints return standardized error responses:

```json
{
  "code": 400,
  "message": "Error description",
  "date": "2025-01-22T04:00:00Z",
  "requestId": "req_xyz789",
  "data": {}
}
```

### Common Error Codes

- `400` - Bad Request (missing required fields, invalid data)
- `401` - Unauthorized (missing or invalid JWT)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (order not found)
- `410` - Gone (request ID expired)
- `500` - Internal Server Error

## Testing

Run the test script to verify API functionality:

```bash
cd CG_payment_service
node scripts/test-mainline-api.js
```

## OpenAPI Specification

The complete API specification is available at `/docs/openapi.yaml` and follows OpenAPI 3.1.0 standards.

## Database Schema

The service uses SQLite with the following key tables:

- `subscription_orders` - Stores payment orders with request IDs
- `payment_events` - Webhook event idempotency
- `client_idempotency` - API request idempotency

## Environment Variables

Required environment variables:

- `JWT_SECRET` - Shared secret with mainline
- `STRIPE_SECRET_KEY` - Stripe API key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signature secret
- `STRIPE_DAILY_PRICE_ID` - Stripe price ID for daily plan
- `STRIPE_WEEKLY_PRICE_ID` - Stripe price ID for weekly plan
- `STRIPE_MONTHLY_PRICE_ID` - Stripe price ID for monthly plan
- `PORT` - Service port (default: 8790)
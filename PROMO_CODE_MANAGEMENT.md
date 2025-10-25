# 🎫 Promo Code Management Guide

This document provides comprehensive information about managing promo codes in the ClassGuruAI payment system.

## 📋 Table of Contents

- [Overview](#overview)
- [Viewing Promo Codes](#viewing-promo-codes)
- [Checking Availability](#checking-availability)
- [Database Structure](#database-structure)
- [API Endpoints](#api-endpoints)
- [Frontend Integration](#frontend-integration)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

The promo code system allows users to apply discount codes during checkout. All promo codes provide 100% discount (free access) for the daily plan ($1.99 SGD).

### Key Features:
- ✅ **Format**: `CG-XXXX-XXXX` (8 alphanumeric characters)
- ✅ **Discount**: 100% off daily plan ($1.99 SGD)
- ✅ **Single Use**: Each code can only be used once
- ✅ **Expiration**: Codes have expiration dates
- ✅ **Validation**: Real-time validation with user feedback

## 🔍 Viewing Promo Codes

### 1. Database Direct Access

Connect to the SQLite database to view all promo codes:

```bash
# Navigate to payment service directory
cd CG_payment_service

# Open database with SQLite
sqlite3 data/payment.db

# View all promo codes
SELECT code, plan_type, plan_amount, plan_currency, is_used, used_by, created_at, expires_at 
FROM promo_codes 
ORDER BY created_at DESC;

# View only available (unused) codes
SELECT code, plan_type, plan_amount, plan_currency, created_at, expires_at 
FROM promo_codes 
WHERE is_used = FALSE 
ORDER BY created_at DESC;

# View used codes
SELECT code, used_by, used_at, created_at 
FROM promo_codes 
WHERE is_used = TRUE 
ORDER BY used_at DESC;
```

### 2. Statistics Overview

Get quick statistics about promo codes:

```sql
-- Get overall statistics
SELECT 
  COUNT(*) as total_codes,
  SUM(CASE WHEN is_used = FALSE THEN 1 ELSE 0 END) as available_codes,
  SUM(CASE WHEN is_used = TRUE THEN 1 ELSE 0 END) as used_codes,
  SUM(CASE WHEN expires_at < strftime('%s', 'now') * 1000 THEN 1 ELSE 0 END) as expired_codes
FROM promo_codes;
```

### 3. Using the API

Check promo code availability via API:

```bash
# Validate a specific promo code
curl -X POST http://localhost:8790/api/promo/validate \
  -H "Content-Type: application/json" \
  -d '{"code": "CG-PR4T-WBBC"}'
```

**Response for valid code:**
```json
{
  "valid": true,
  "message": "Promo code is valid",
  "code": "CG-PR4T-WBBC",
  "planType": "daily-plan",
  "planAmount": 1.99,
  "planCurrency": "SGD",
  "expiresAt": 1735689600000
}
```

**Response for invalid/used code:**
```json
{
  "valid": false,
  "message": "Promo code has already been used"
}
```

## 📊 Checking Availability

### 1. Real-time Validation

The system provides real-time validation through multiple channels:

#### Frontend Validation
- Users can enter promo codes in the payment form
- Instant feedback shows if code is valid/invalid
- Visual indicators show discount amount

#### API Validation
- `POST /api/promo/validate` - Check if code is valid
- Returns detailed information about the code
- Handles all validation scenarios

### 2. Database Queries

#### Available Codes (Unused & Not Expired)
```sql
SELECT code, created_at, expires_at 
FROM promo_codes 
WHERE is_used = FALSE 
  AND (expires_at IS NULL OR expires_at > strftime('%s', 'now') * 1000)
ORDER BY created_at DESC;
```

#### Recently Used Codes
```sql
SELECT code, used_by, used_at, 
       datetime(used_at/1000, 'unixepoch') as used_date
FROM promo_codes 
WHERE is_used = TRUE 
ORDER BY used_at DESC 
LIMIT 10;
```

#### Expired Codes
```sql
SELECT code, created_at, expires_at,
       datetime(expires_at/1000, 'unixepoch') as expired_date
FROM promo_codes 
WHERE expires_at < strftime('%s', 'now') * 1000
ORDER BY expires_at DESC;
```

## 🗄️ Database Structure

### Promo Codes Table Schema

```sql
CREATE TABLE promo_codes (
  code TEXT PRIMARY KEY,           -- Format: CG-XXXX-XXXX
  plan_type TEXT NOT NULL,        -- Always 'daily-plan'
  plan_amount REAL NOT NULL,      -- Always 1.99
  plan_currency TEXT NOT NULL,    -- Always 'SGD'
  is_used BOOLEAN DEFAULT FALSE,  -- Usage status
  used_by TEXT,                   -- User ID who used the code
  created_at INTEGER NOT NULL,    -- Creation timestamp
  used_at INTEGER,                -- Usage timestamp
  expires_at INTEGER              -- Expiration timestamp
);
```

### Key Fields:
- **`code`**: Unique identifier (e.g., `CG-PR4T-WBBC`)
- **`is_used`**: Boolean flag for usage status
- **`used_by`**: User ID of the person who redeemed the code
- **`expires_at`**: Expiration timestamp (milliseconds)

## 🔌 API Endpoints

### 1. Validate Promo Code
```http
POST /api/promo/validate
Content-Type: application/json

{
  "code": "CG-PR4T-WBBC"
}
```

**Responses:**
- `200` - Valid code
- `400` - Invalid format, already used, or expired
- `404` - Code not found

### 2. Create Subscription (with Promo Code)
```http
POST /api/payment/create-subscription
Content-Type: application/json

{
  "jwt": "user_jwt_token",
  "product_id": "daily-plan",
  "currency": "SGD",
  "platform": "web",
  "client_ref": "optional_reference",
  "promo_code": "CG-PR4T-WBBC"
}
```

## 🎨 Frontend Integration

### Promo Code Input Field
Located in the payment form (`frontend/index.html`):

```html
<div class="promo-code-section">
  <label for="promoCode">Promo Code (Optional)</label>
  <div class="promo-input-group">
    <input type="text" id="promoCode" placeholder="Enter promo code" maxlength="13">
    <button type="button" id="applyPromoBtn">Apply</button>
  </div>
  <div id="promoStatus" class="promo-status"></div>
</div>
```

### JavaScript Functions
- `validatePromoCode(code)` - Validates code via API
- `applyPromoCode()` - Applies valid code to order
- `removePromoCode()` - Removes applied code
- `updatePricingWithDiscount()` - Updates UI with discount

## 🛠️ Management Commands

### Generate New Promo Codes
```bash
# Generate 10 new promo codes
node scripts/generate-promo-codes.js --count 10

# Generate 100 codes and export to file
node scripts/generate-promo-codes.js --count 100 --export
```

### Check Database Status
```bash
# View database file location
ls -la data/payment.db

# Check database integrity
sqlite3 data/payment.db "PRAGMA integrity_check;"

# Get table info
sqlite3 data/payment.db ".schema promo_codes"
```

## 🔧 Troubleshooting

### Common Issues

#### 1. "Promo code not found"
- **Cause**: Code doesn't exist in database
- **Solution**: Check code format and database entries

#### 2. "Promo code has already been used"
- **Cause**: Code was previously redeemed
- **Solution**: Use a different available code

#### 3. "Promo code has expired"
- **Cause**: Code passed its expiration date
- **Solution**: Generate new codes or extend expiration

#### 4. "Invalid promo code format"
- **Cause**: Code doesn't match `CG-XXXX-XXXX` pattern
- **Solution**: Ensure proper format with uppercase letters

### Debug Commands

```bash
# Check server logs
tail -f logs/payment-service.log

# Test API endpoint
curl -X POST http://localhost:8790/api/promo/validate \
  -H "Content-Type: application/json" \
  -d '{"code": "CG-PR4T-WBBC"}' | jq

# Check database connection
sqlite3 data/payment.db "SELECT COUNT(*) FROM promo_codes;"
```

## 📈 Monitoring & Analytics

### Key Metrics to Track

1. **Total Codes Generated**: `SELECT COUNT(*) FROM promo_codes;`
2. **Usage Rate**: `SELECT (used_codes * 100.0 / total_codes) as usage_rate FROM (SELECT COUNT(*) as total_codes, SUM(CASE WHEN is_used = TRUE THEN 1 ELSE 0 END) as used_codes FROM promo_codes);`
3. **Recent Activity**: `SELECT code, used_by, datetime(used_at/1000, 'unixepoch') as used_date FROM promo_codes WHERE is_used = TRUE ORDER BY used_at DESC LIMIT 10;`

### Health Checks

```bash
# Check if promo code system is working
curl -X GET http://localhost:8790/health

# Validate a known good code
curl -X POST http://localhost:8790/api/promo/validate \
  -H "Content-Type: application/json" \
  -d '{"code": "CG-PR4T-WBBC"}'
```

## 🚀 Quick Start

1. **Start the server**:
   ```bash
   cd CG_payment_service
   npm start
   ```

2. **Check available codes**:
   ```bash
   sqlite3 data/payment.db "SELECT code FROM promo_codes WHERE is_used = FALSE LIMIT 5;"
   ```

3. **Test a code**:
   ```bash
   curl -X POST http://localhost:8790/api/promo/validate \
     -H "Content-Type: application/json" \
     -d '{"code": "CG-PR4T-WBBC"}'
   ```

4. **View frontend**:
   Open `http://localhost:8790` and test the promo code input field

---

## 📞 Support

For issues or questions about promo code management:
- Check server logs in `logs/payment-service.log`
- Verify database integrity with SQLite commands
- Test API endpoints with curl commands
- Review frontend console for JavaScript errors

**Last Updated**: October 25, 2025
**Version**: 1.0.0

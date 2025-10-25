# 🎫 Promo Code Quick Reference

## 📊 Current Status
- **Total Codes**: 205
- **Available**: 204 (99.5%)
- **Used**: 1 (0.5%)
- **Expired**: 0 (0.0%)

## 🔍 Quick Commands

### Check Promo Code Status
```bash
# Overall statistics
node scripts/check-promo-codes.js stats

# Available codes (first 10)
node scripts/check-promo-codes.js available

# Check specific code
node scripts/check-promo-codes.js check CG-PR4T-WBBC

# Recently used codes
node scripts/check-promo-codes.js used

# All information
node scripts/check-promo-codes.js all
```

### Database Direct Access
```bash
# Open database
sqlite3 data/payment.db

# Quick stats
SELECT COUNT(*) as total, 
       SUM(CASE WHEN is_used = FALSE THEN 1 ELSE 0 END) as available,
       SUM(CASE WHEN is_used = TRUE THEN 1 ELSE 0 END) as used
FROM promo_codes;

# Available codes
SELECT code FROM promo_codes WHERE is_used = FALSE LIMIT 10;

# Used codes
SELECT code, used_by, datetime(used_at/1000, 'unixepoch') as used_date 
FROM promo_codes WHERE is_used = TRUE ORDER BY used_at DESC LIMIT 5;
```

### API Testing
```bash
# Test promo code validation
curl -X POST http://localhost:8790/api/promo/validate \
  -H "Content-Type: application/json" \
  -d '{"code": "CG-PR4T-WBBC"}'

# Test payment with promo code
curl -X POST http://localhost:8790/api/payment/create-subscription \
  -H "Content-Type: application/json" \
  -d '{
    "jwt": "your_jwt_token",
    "product_id": "daily-plan",
    "currency": "SGD",
    "platform": "web",
    "promo_code": "CG-PR4T-WBBC"
  }'
```

## 🎯 Available Codes (Sample)
1. `CG-P7AP-29RQ` - Expires: 10/25/2026
2. `CG-6J92-RGEK` - Expires: 10/25/2026
3. `CG-KY69-IQ50` - Expires: 10/25/2026
4. `CG-ZEXM-3G6Q` - Expires: 10/25/2026
5. `CG-BK34-0V11` - Expires: 10/25/2026

## 📝 Recently Used
- `CG-PR4T-WBBC` - Used by: test-user-ust1zmsf (10/25/2025, 9:25:51 PM)

## 🔧 Troubleshooting

### Server Issues
```bash
# Check if server is running
curl http://localhost:8790/health

# View server logs
tail -f logs/payment-service.log

# Restart server
pkill -f "tsx src/server.ts" && npm start
```

### Database Issues
```bash
# Check database integrity
sqlite3 data/payment.db "PRAGMA integrity_check;"

# Check table structure
sqlite3 data/payment.db ".schema promo_codes"
```

### Frontend Testing
1. Open `http://localhost:8790`
2. Enter a promo code in the form
3. Check browser console for errors
4. Verify API calls in Network tab

## 📞 Quick Help

- **Full Documentation**: See `PROMO_CODE_MANAGEMENT.md`
- **Database Location**: `data/payment.db`
- **Logs**: `logs/payment-service.log`
- **Frontend**: `frontend/index.html`

---
*Last Updated: October 25, 2025*

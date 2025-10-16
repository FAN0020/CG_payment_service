# Quick Start Guide - Idempotency Tests

## TL;DR

```bash
cd /Users/fanyupei/Codes/ClassGuruAI/CG_payment_service/examples/idempotency-tests
./run-tests.sh
```

Expected output:
```
[✓ SUCCESS] All 4 tests passed! 🎉
```

## What This Tests

✅ Idempotency prevents duplicate orders  
✅ Race conditions are handled correctly  
✅ Concurrent requests get the same order  
✅ Different idempotency keys create different orders  

## No Setup Required

- ❌ No Stripe account needed
- ❌ No API keys required
- ❌ No manual service startup
- ✅ Fully automated test suite

## Files Overview

| File | Purpose |
|------|---------|
| `run-tests.sh` | Main test execution script (start here!) |
| `test-runner.js` | Test implementation |
| `README.md` | Detailed documentation |
| `TEST_SUMMARY.md` | Latest test results and findings |

## How It Works

1. **Starts service** with mock Stripe (no real API calls)
2. **Runs 4 tests** validating idempotency mechanism
3. **Shows results** with color-coded output
4. **Cleans up** automatically

## Troubleshooting

### Tests fail?
Check the detailed logs in the output - look for lines starting with `[  →]`

### Service won't start?
```bash
# Kill any existing instances
pkill -f "tsx watch"

# Check if port 8790 is in use
lsof -i :8790
```

### Want more details?
Read `README.md` for comprehensive documentation

## Success Criteria

All 4 tests should pass:
- ✅ Test 1: Single request should succeed
- ✅ Test 2: Duplicate requests should return same response  
- ✅ Test 3: Concurrent requests should handle race conditions
- ✅ Test 4: Different idempotency keys should create different subscriptions

## Exit Codes

- `0` = All tests passed
- `1` = One or more tests failed

Perfect for CI/CD integration!


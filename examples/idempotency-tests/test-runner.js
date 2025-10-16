#!/usr/bin/env node

const jwt = require('jsonwebtoken');
const http = require('http');

// Configuration
const API_BASE = 'http://localhost:8790';
const JWT_SECRET = 'demo_jwt_secret_at_least_32_characters_long_for_classguru_payment_service';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function log(color, prefix, message) {
  console.log(`${color}[${prefix}]${colors.reset} ${message}`);
}

function logInfo(message) { log(colors.blue, 'INFO', message); }
function logSuccess(message) { log(colors.green, '✓ SUCCESS', message); }
function logError(message) { log(colors.red, '✗ ERROR', message); }
function logTest(message) { log(colors.cyan, 'TEST', message); }
function logDetail(message) { log(colors.gray, '  →', message); }

// Generate JWT token
function generateToken(userId = 'user_test123', email = 'test@example.com') {
  return jwt.sign({ sub: userId, email }, JWT_SECRET);
}

// Make HTTP request
async function makeRequest(path, data, method = 'POST') {
  return new Promise((resolve, reject) => {
    const body = method === 'GET' ? '' : JSON.stringify(data);
    const options = {
      hostname: '127.0.0.1',  // Use IPv4 explicitly
      port: 8790,
      path,
      method,
      headers: method === 'GET' ? {} : {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 10000
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

// Test: Single request should succeed
async function testSingleRequest() {
  logTest('Test 1: Single request should succeed');
  
  const token = generateToken();
  const idempotencyKey = `single-${Date.now()}`;
  
  logDetail(`Idempotency key: ${idempotencyKey}`);
  
  try {
    const response = await makeRequest('/api/payment/create-subscription', {
      jwt: token,
      idempotency_key: idempotencyKey,
      product_id: 'trial-plan',
      currency: 'USD',
      customer_email: 'test@example.com'
    });
    
    logDetail(`Response status: ${response.status}`);
    logDetail(`Response data: ${JSON.stringify(response.data, null, 2)}`);
    
    if (response.status === 200 && response.data.data?.order_id) {
      logSuccess('Single request succeeded');
      logDetail(`Created order: ${response.data.data.order_id}`);
      return true;
    } else {
      logError(`Unexpected response: ${JSON.stringify(response.data)}`);
      return false;
    }
  } catch (error) {
    logError(`Request failed: ${error.message}`);
    return false;
  }
}

// Test: Duplicate requests should return cached response
async function testIdempotency() {
  logTest('Test 2: Duplicate requests should return same response');
  
  const token = generateToken();
  const idempotencyKey = `duplicate-${Date.now()}`;
  
  logDetail(`Idempotency key: ${idempotencyKey}`);
  
  try {
    // First request
    logDetail('Sending first request...');
    const response1 = await makeRequest('/api/payment/create-subscription', {
      jwt: token,
      idempotency_key: idempotencyKey,
      product_id: 'trial-plan',
      currency: 'USD',
      customer_email: 'test1@example.com'
    });
    
    logDetail(`First response status: ${response1.status}`);
    logDetail(`First response: ${JSON.stringify(response1.data, null, 2)}`);
    
    if (response1.status !== 200) {
      logError('First request failed');
      return false;
    }
    
    const firstOrderId = response1.data.data?.order_id;
    logDetail(`First order ID: ${firstOrderId}`);
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Second request with same idempotency key
    logDetail('Sending duplicate request...');
    const response2 = await makeRequest('/api/payment/create-subscription', {
      jwt: token,
      idempotency_key: idempotencyKey,
      product_id: 'trial-plan',
      currency: 'USD',
      customer_email: 'test2@example.com' // Different email!
    });
    
    logDetail(`Second response status: ${response2.status}`);
    logDetail(`Second response: ${JSON.stringify(response2.data, null, 2)}`);
    
    const secondOrderId = response2.data.data?.order_id;
    logDetail(`Second order ID: ${secondOrderId}`);
    
    if (firstOrderId === secondOrderId && firstOrderId) {
      logSuccess('Idempotency working: both requests returned same order');
      return true;
    } else {
      logError(`Idempotency failed: got different orders (${firstOrderId} vs ${secondOrderId})`);
      return false;
    }
  } catch (error) {
    logError(`Request failed: ${error.message}`);
    return false;
  }
}

// Test: Concurrent requests with same idempotency key
async function testConcurrentRequests() {
  logTest('Test 3: Concurrent requests should handle race conditions');
  
  const token = generateToken();
  const idempotencyKey = `concurrent-${Date.now()}`;
  
  logDetail(`Idempotency key: ${idempotencyKey}`);
  logDetail('Sending 5 concurrent requests...');
  
  try {
    const requests = Array(5).fill(null).map((_, i) => 
      makeRequest('/api/payment/create-subscription', {
        jwt: token,
        idempotency_key: idempotencyKey,
        product_id: 'trial-plan',
        currency: 'USD',
        customer_email: `concurrent${i}@example.com`
      })
    );
    
    const responses = await Promise.all(requests);
    
    logDetail(`All ${responses.length} responses received`);
    
    const orderIds = responses.map(r => r.data.data?.order_id);
    const uniqueIds = [...new Set(orderIds)].filter(id => id);
    
    logDetail(`Order IDs: ${orderIds.join(', ')}`);
    logDetail(`Unique order IDs: ${uniqueIds.length}`);
    
    if (uniqueIds.length === 1 && orderIds.every(id => id === uniqueIds[0])) {
      logSuccess('Concurrent requests handled correctly: all got same order');
      return true;
    } else {
      logError(`Race condition detected: got ${uniqueIds.length} different orders`);
      return false;
    }
  } catch (error) {
    logError(`Request failed: ${error.message}`);
    return false;
  }
}

// Test: Different idempotency keys should create different subscriptions
async function testDifferentKeys() {
  logTest('Test 4: Different idempotency keys should create different subscriptions');
  
  const token = generateToken();
  const key1 = `different-1-${Date.now()}`;
  const key2 = `different-2-${Date.now()}`;
  
  logDetail(`Key 1: ${key1}`);
  logDetail(`Key 2: ${key2}`);
  
  try {
    const response1 = await makeRequest('/api/payment/create-subscription', {
      jwt: token,
      idempotency_key: key1,
      product_id: 'trial-plan',
      currency: 'USD',
      customer_email: 'test1@example.com'
    });
    
    const response2 = await makeRequest('/api/payment/create-subscription', {
      jwt: token,
      idempotency_key: key2,
      product_id: 'trial-plan',
      currency: 'USD',
      customer_email: 'test2@example.com'
    });
    
    const id1 = response1.data.data?.order_id;
    const id2 = response2.data.data?.order_id;
    
    logDetail(`Order 1: ${id1}`);
    logDetail(`Order 2: ${id2}`);
    
    if (id1 && id2 && id1 !== id2) {
      logSuccess('Different keys created different orders');
      return true;
    } else {
      logError('Different keys returned same order or missing IDs');
      return false;
    }
  } catch (error) {
    logError(`Request failed: ${error.message}`);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('  PAYMENT SERVICE IDEMPOTENCY TESTS');
  console.log('='.repeat(60) + '\n');
  
  // Check if service is running
  logInfo('Checking if payment service is running...');
  try {
    const response = await makeRequest('/api/payment/health', {}, 'GET');
    if (response.status === 200) {
      logSuccess('Payment service is running');
    } else {
      throw new Error('Unexpected response');
    }
  } catch (error) {
    logError('Payment service is not responding. Please start it first.');
    logError('Run: npm run dev');
    process.exit(1);
  }
  
  console.log('\n' + '-'.repeat(60) + '\n');
  
  const results = [];
  
  // Run tests sequentially
  results.push(await testSingleRequest());
  console.log();
  
  results.push(await testIdempotency());
  console.log();
  
  results.push(await testConcurrentRequests());
  console.log();
  
  results.push(await testDifferentKeys());
  console.log();
  
  // Summary
  console.log('-'.repeat(60));
  console.log('\n  TEST SUMMARY\n');
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  if (passed === total) {
    logSuccess(`All ${total} tests passed! 🎉`);
    process.exit(0);
  } else {
    logError(`${passed}/${total} tests passed`);
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  logError(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});


/**
 * Test Utilities for Credits Integration Tests
 * Helper functions for making API calls, assertions, and test setup
 */

import { TEST_CONFIG } from './test-data.js';

/**
 * Make HTTP request with error handling and logging
 */
export async function makeRequest(url, options = {}) {
  const startTime = Date.now();
  
  try {
    const response = await fetch(url, {
      timeout: TEST_CONFIG.TIMEOUT,
      ...options
    });
    
    const duration = Date.now() - startTime;
    const data = await response.json();
    
    return {
      success: true,
      status: response.status,
      data,
      duration,
      url,
      method: options.method || 'GET'
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    return {
      success: false,
      error: error.message,
      duration,
      url,
      method: options.method || 'GET'
    };
  }
}

/**
 * Test credits status API
 */
export async function testCreditsStatus(userId) {
  const url = `${TEST_CONFIG.PAYMENT_SERVICE_URL}/api/credits/status?uid=${userId}`;
  return await makeRequest(url);
}

/**
 * Test credits deduction API
 */
export async function testCreditsDeduct(jwt, amount = 1, reason = 'ad_skip') {
  const url = `${TEST_CONFIG.PAYMENT_SERVICE_URL}/api/credits/deduct`;
  return await makeRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jwt, amount, reason })
  });
}

/**
 * Test credits reward API
 */
export async function testCreditsReward(jwt, amount = 1, reason = 'ad_watch') {
  const url = `${TEST_CONFIG.PAYMENT_SERVICE_URL}/api/credits/reward`;
  return await makeRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jwt, amount, reason })
  });
}

/**
 * Test ad request API
 */
export async function testAdRequest(jwt, adRequest) {
  const url = `${TEST_CONFIG.AD_SERVICE_URL}/api/ads/request`;
  return await makeRequest(url, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt}`
    },
    body: JSON.stringify(adRequest)
  });
}

/**
 * Assert response structure and values
 */
export function assertResponse(response, expectedStructure) {
  const errors = [];
  
  // Check if request was successful
  if (!response.success) {
    errors.push(`Request failed: ${response.error}`);
    return { passed: false, errors };
  }
  
  // Check status code
  if (expectedStructure.status && response.status !== expectedStructure.status) {
    errors.push(`Expected status ${expectedStructure.status}, got ${response.status}`);
  }
  
  // Check response data structure
  if (expectedStructure.data) {
    const data = response.data.data || response.data;
    for (const [key, expectedValue] of Object.entries(expectedStructure.data)) {
      if (data[key] !== expectedValue) {
        errors.push(`Expected ${key} to be ${expectedValue}, got ${data[key]}`);
      }
    }
  }
  
  // Check success field
  if (expectedStructure.success !== undefined && response.data.success !== expectedStructure.success) {
    errors.push(`Expected success to be ${expectedStructure.success}, got ${response.data.success}`);
  }
  
  return {
    passed: errors.length === 0,
    errors
  };
}

/**
 * Assert that ad should be skipped
 */
export function assertAdSkipped(response) {
  const errors = [];
  
  if (!response.success) {
    errors.push(`Ad request failed: ${response.error}`);
    return { passed: false, errors };
  }
  
  const data = response.data;
  
  if (data.ad !== null) {
    errors.push(`Expected ad to be null (skipped), got: ${JSON.stringify(data.ad)}`);
  }
  
  if (data.skipReason !== 'premium_or_credits') {
    errors.push(`Expected skipReason to be 'premium_or_credits', got: ${data.skipReason}`);
  }
  
  return {
    passed: errors.length === 0,
    errors
  };
}

/**
 * Assert that ad should be shown
 */
export function assertAdShown(response) {
  const errors = [];
  
  if (!response.success) {
    errors.push(`Ad request failed: ${response.error}`);
    return { passed: false, errors };
  }
  
  const data = response.data;
  
  if (data.ad === null) {
    errors.push(`Expected ad to be shown, got null`);
  }
  
  if (!data.ad || !data.ad.id) {
    errors.push(`Expected ad to have id, got: ${JSON.stringify(data.ad)}`);
  }
  
  return {
    passed: errors.length === 0,
    errors
  };
}

/**
 * Assert credits balance
 */
export function assertCreditsBalance(response, expectedBalance) {
  const errors = [];
  
  if (!response.success) {
    errors.push(`Credits request failed: ${response.error}`);
    return { passed: false, errors };
  }
  
  const data = response.data.data || response.data;
  
  if (data.credits_balance !== expectedBalance) {
    errors.push(`Expected credits balance ${expectedBalance}, got ${data.credits_balance}`);
  }
  
  return {
    passed: errors.length === 0,
    errors
  };
}

/**
 * Assert premium status
 */
export function assertPremiumStatus(response, expectedPremium) {
  const errors = [];
  
  if (!response.success) {
    errors.push(`Credits request failed: ${response.error}`);
    return { passed: false, errors };
  }
  
  const data = response.data.data || response.data;
  
  if (data.is_premium !== expectedPremium) {
    errors.push(`Expected is_premium to be ${expectedPremium}, got ${data.is_premium}`);
  }
  
  return {
    passed: errors.length === 0,
    errors
  };
}

/**
 * Wait for specified time
 */
export function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if service is running
 */
export async function checkServiceHealth(serviceUrl, serviceName) {
  try {
    const response = await makeRequest(`${serviceUrl}/api/credits/health`);
    return {
      running: response.success && response.status === 200,
      response
    };
  } catch (error) {
    return {
      running: false,
      error: error.message
    };
  }
}

/**
 * Setup test environment
 */
export async function setupTestEnvironment() {
  console.log('🔧 Setting up test environment...');
  
  // Check payment service
  const paymentHealth = await checkServiceHealth(TEST_CONFIG.PAYMENT_SERVICE_URL, 'Payment Service');
  if (!paymentHealth.running) {
    throw new Error(`Payment service not running at ${TEST_CONFIG.PAYMENT_SERVICE_URL}`);
  }
  
  // Check ad service
  const adHealth = await checkServiceHealth(TEST_CONFIG.AD_SERVICE_URL, 'Ad Service');
  if (!adHealth.running) {
    throw new Error(`Ad service not running at ${TEST_CONFIG.AD_SERVICE_URL}`);
  }
  
  console.log('✅ Test environment ready');
  return {
    paymentService: paymentHealth,
    adService: adHealth
  };
}

/**
 * Cleanup test environment
 */
export async function cleanupTestEnvironment() {
  console.log('🧹 Cleaning up test environment...');
  // Add any cleanup logic here if needed
  console.log('✅ Test environment cleaned up');
}

/**
 * Run test with retry logic
 */
export async function runTestWithRetry(testFunction, maxRetries = 3, delay = 1000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await testFunction();
      if (result.passed) {
        return result;
      }
      lastError = new Error(`Test failed: ${result.errors.join(', ')}`);
    } catch (error) {
      lastError = error;
    }
    
    if (attempt < maxRetries) {
      console.log(`⏳ Retry ${attempt}/${maxRetries} in ${delay}ms...`);
      await wait(delay);
    }
  }
  
  throw lastError;
}

/**
 * Generate test report
 */
export function generateTestReport(testResults) {
  const total = testResults.length;
  const passed = testResults.filter(r => r.passed).length;
  const failed = total - passed;
  
  console.log('\n📊 Test Report');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults
      .filter(r => !r.passed)
      .forEach(result => {
        console.log(`  - ${result.name}: ${result.errors.join(', ')}`);
      });
  }
  
  return {
    total,
    passed,
    failed,
    successRate: (passed / total) * 100
  };
}

export default {
  makeRequest,
  testCreditsStatus,
  testCreditsDeduct,
  testCreditsReward,
  testAdRequest,
  assertResponse,
  assertAdSkipped,
  assertAdShown,
  assertCreditsBalance,
  assertPremiumStatus,
  wait,
  checkServiceHealth,
  setupTestEnvironment,
  cleanupTestEnvironment,
  runTestWithRetry,
  generateTestReport
};

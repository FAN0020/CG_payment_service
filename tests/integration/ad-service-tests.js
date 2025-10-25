/**
 * Ad Service Integration Tests
 * Tests the ad service's integration with credits and premium status
 */

import { 
  testAdRequest, 
  assertAdSkipped, 
  assertAdShown,
  assertResponse,
  runTestWithRetry
} from './test-utils.js';
import { 
  TEST_USERS, 
  TEST_JWTS, 
  TEST_AD_REQUESTS,
  TEST_SCENARIOS 
} from './test-data.js';

/**
 * Test ad request for premium user (should skip ad)
 */
export async function testPremiumUserAdRequest() {
  console.log('🧪 Testing premium user ad request...');
  
  const scenario = TEST_SCENARIOS.PREMIUM_USER_AD_REQUEST;
  const adRequest = TEST_AD_REQUESTS.BANNER_AD;
  
  try {
    const response = await testAdRequest(scenario.jwt, adRequest);
    const assertion = assertAdSkipped(response);
    
    if (assertion.passed) {
      console.log('✅ Premium user ad request: PASSED');
      return { name: 'Premium User Ad Request', passed: true };
    } else {
      console.log('❌ Premium user ad request: FAILED');
      console.log('   Errors:', assertion.errors);
      return { name: 'Premium User Ad Request', passed: false, errors: assertion.errors };
    }
  } catch (error) {
    console.log('❌ Premium user ad request: ERROR');
    console.log('   Error:', error.message);
    return { name: 'Premium User Ad Request', passed: false, errors: [error.message] };
  }
}

/**
 * Test ad request for user with credits (should skip ad and deduct credit)
 */
export async function testCreditUserAdRequest() {
  console.log('🧪 Testing credit user ad request...');
  
  const scenario = TEST_SCENARIOS.CREDIT_USER_AD_REQUEST;
  const adRequest = TEST_AD_REQUESTS.BANNER_AD;
  
  try {
    const response = await testAdRequest(scenario.jwt, adRequest);
    const assertion = assertAdSkipped(response);
    
    if (assertion.passed) {
      console.log('✅ Credit user ad request: PASSED');
      return { name: 'Credit User Ad Request', passed: true };
    } else {
      console.log('❌ Credit user ad request: FAILED');
      console.log('   Errors:', assertion.errors);
      return { name: 'Credit User Ad Request', passed: false, errors: assertion.errors };
    }
  } catch (error) {
    console.log('❌ Credit user ad request: ERROR');
    console.log('   Error:', error.message);
    return { name: 'Credit User Ad Request', passed: false, errors: [error.message] };
  }
}

/**
 * Test ad request for free user (should show ad)
 */
export async function testFreeUserAdRequest() {
  console.log('🧪 Testing free user ad request...');
  
  const scenario = TEST_SCENARIOS.FREE_USER_AD_REQUEST;
  const adRequest = TEST_AD_REQUESTS.BANNER_AD;
  
  try {
    const response = await testAdRequest(scenario.jwt, adRequest);
    const assertion = assertAdShown(response);
    
    if (assertion.passed) {
      console.log('✅ Free user ad request: PASSED');
      return { name: 'Free User Ad Request', passed: true };
    } else {
      console.log('❌ Free user ad request: FAILED');
      console.log('   Errors:', assertion.errors);
      return { name: 'Free User Ad Request', passed: false, errors: assertion.errors };
    }
  } catch (error) {
    console.log('❌ Free user ad request: ERROR');
    console.log('   Error:', error.message);
    return { name: 'Free User Ad Request', passed: false, errors: [error.message] };
  }
}

/**
 * Test ad request for user with low credits (should skip ad and deduct credit)
 */
export async function testLowCreditsUserAdRequest() {
  console.log('🧪 Testing low credits user ad request...');
  
  const scenario = TEST_SCENARIOS.LOW_CREDITS_USER_AD_REQUEST;
  const adRequest = TEST_AD_REQUESTS.BANNER_AD;
  
  try {
    const response = await testAdRequest(scenario.jwt, adRequest);
    const assertion = assertAdSkipped(response);
    
    if (assertion.passed) {
      console.log('✅ Low credits user ad request: PASSED');
      return { name: 'Low Credits User Ad Request', passed: true };
    } else {
      console.log('❌ Low credits user ad request: FAILED');
      console.log('   Errors:', assertion.errors);
      return { name: 'Low Credits User Ad Request', passed: false, errors: assertion.errors };
    }
  } catch (error) {
    console.log('❌ Low credits user ad request: ERROR');
    console.log('   Error:', error.message);
    return { name: 'Low Credits User Ad Request', passed: false, errors: [error.message] };
  }
}

/**
 * Test ad request with invalid JWT (should show ad)
 */
export async function testInvalidJWTAdRequest() {
  console.log('🧪 Testing invalid JWT ad request...');
  
  const invalidJWT = TEST_JWTS.INVALID_JWT;
  const adRequest = TEST_AD_REQUESTS.BANNER_AD;
  
  try {
    const response = await testAdRequest(invalidJWT, adRequest);
    const assertion = assertAdShown(response);
    
    if (assertion.passed) {
      console.log('✅ Invalid JWT ad request: PASSED');
      return { name: 'Invalid JWT Ad Request', passed: true };
    } else {
      console.log('❌ Invalid JWT ad request: FAILED');
      console.log('   Errors:', assertion.errors);
      return { name: 'Invalid JWT Ad Request', passed: false, errors: assertion.errors };
    }
  } catch (error) {
    console.log('❌ Invalid JWT ad request: ERROR');
    console.log('   Error:', error.message);
    return { name: 'Invalid JWT Ad Request', passed: false, errors: [error.message] };
  }
}

/**
 * Test ad request with expired JWT (should show ad)
 */
export async function testExpiredJWTAdRequest() {
  console.log('🧪 Testing expired JWT ad request...');
  
  const expiredJWT = TEST_JWTS.EXPIRED_JWT;
  const adRequest = TEST_AD_REQUESTS.BANNER_AD;
  
  try {
    const response = await testAdRequest(expiredJWT, adRequest);
    const assertion = assertAdShown(response);
    
    if (assertion.passed) {
      console.log('✅ Expired JWT ad request: PASSED');
      return { name: 'Expired JWT Ad Request', passed: true };
    } else {
      console.log('❌ Expired JWT ad request: FAILED');
      console.log('   Errors:', assertion.errors);
      return { name: 'Expired JWT Ad Request', passed: false, errors: assertion.errors };
    }
  } catch (error) {
    console.log('❌ Expired JWT ad request: ERROR');
    console.log('   Error:', error.message);
    return { name: 'Expired JWT Ad Request', passed: false, errors: [error.message] };
  }
}

/**
 * Test ad request with missing JWT (should show ad)
 */
export async function testMissingJWTAdRequest() {
  console.log('🧪 Testing missing JWT ad request...');
  
  const adRequest = TEST_AD_REQUESTS.BANNER_AD;
  
  try {
    const response = await testAdRequest('', adRequest);
    const assertion = assertAdShown(response);
    
    if (assertion.passed) {
      console.log('✅ Missing JWT ad request: PASSED');
      return { name: 'Missing JWT Ad Request', passed: true };
    } else {
      console.log('❌ Missing JWT ad request: FAILED');
      console.log('   Errors:', assertion.errors);
      return { name: 'Missing JWT Ad Request', passed: false, errors: assertion.errors };
    }
  } catch (error) {
    console.log('❌ Missing JWT ad request: ERROR');
    console.log('   Error:', error.message);
    return { name: 'Missing JWT Ad Request', passed: false, errors: [error.message] };
  }
}

/**
 * Test video ad request for credit user
 */
export async function testVideoAdRequest() {
  console.log('🧪 Testing video ad request...');
  
  const scenario = TEST_SCENARIOS.CREDIT_USER_AD_REQUEST;
  const adRequest = TEST_AD_REQUESTS.VIDEO_AD;
  
  try {
    const response = await testAdRequest(scenario.jwt, adRequest);
    const assertion = assertAdSkipped(response);
    
    if (assertion.passed) {
      console.log('✅ Video ad request: PASSED');
      return { name: 'Video Ad Request', passed: true };
    } else {
      console.log('❌ Video ad request: FAILED');
      console.log('   Errors:', assertion.errors);
      return { name: 'Video Ad Request', passed: false, errors: assertion.errors };
    }
  } catch (error) {
    console.log('❌ Video ad request: ERROR');
    console.log('   Error:', error.message);
    return { name: 'Video Ad Request', passed: false, errors: [error.message] };
  }
}

/**
 * Test ad request with malformed request body
 */
export async function testMalformedAdRequest() {
  console.log('🧪 Testing malformed ad request...');
  
  const scenario = TEST_SCENARIOS.CREDIT_USER_AD_REQUEST;
  
  try {
    // Test with missing required fields
    const malformedRequest = { page: 'test' }; // Missing format, sessionId, deviceType
    const response = await testAdRequest(scenario.jwt, malformedRequest);
    
    // Should still work (graceful degradation)
    const assertion = assertAdSkipped(response);
    
    if (assertion.passed) {
      console.log('✅ Malformed ad request: PASSED');
      return { name: 'Malformed Ad Request', passed: true };
    } else {
      console.log('❌ Malformed ad request: FAILED');
      console.log('   Errors:', assertion.errors);
      return { name: 'Malformed Ad Request', passed: false, errors: assertion.errors };
    }
  } catch (error) {
    console.log('❌ Malformed ad request: ERROR');
    console.log('   Error:', error.message);
    return { name: 'Malformed Ad Request', passed: false, errors: [error.message] };
  }
}

/**
 * Run all ad service tests
 */
export async function runAdServiceTests() {
  console.log('\n🎯 Running Ad Service Tests');
  console.log('='.repeat(50));
  
  const tests = [
    testPremiumUserAdRequest,
    testCreditUserAdRequest,
    testFreeUserAdRequest,
    testLowCreditsUserAdRequest,
    testInvalidJWTAdRequest,
    testExpiredJWTAdRequest,
    testMissingJWTAdRequest,
    testVideoAdRequest,
    testMalformedAdRequest
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      const result = await runTestWithRetry(test, 2, 1000);
      results.push(result);
    } catch (error) {
      results.push({
        name: test.name,
        passed: false,
        errors: [error.message]
      });
    }
  }
  
  return results;
}

export default {
  testPremiumUserAdRequest,
  testCreditUserAdRequest,
  testFreeUserAdRequest,
  testLowCreditsUserAdRequest,
  testInvalidJWTAdRequest,
  testExpiredJWTAdRequest,
  testMissingJWTAdRequest,
  testVideoAdRequest,
  testMalformedAdRequest,
  runAdServiceTests
};

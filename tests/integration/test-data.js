/**
 * Test Data for Credits Integration Tests
 * Contains mock users, JWTs, and test scenarios
 */

// Test JWT Secret (must match both services)
const TEST_JWT_SECRET = 'test-jwt-secret-for-integration-testing';

// Test Users
export const TEST_USERS = {
  PREMIUM_USER: {
    id: 'premium-user-123',
    email: 'premium@test.com',
    subscription: 'active',
    credits: 0
  },
  CREDIT_USER: {
    id: 'credit-user-456',
    email: 'credit@test.com',
    subscription: 'inactive',
    credits: 5
  },
  FREE_USER: {
    id: 'free-user-789',
    email: 'free@test.com',
    subscription: 'inactive',
    credits: 0
  },
  LOW_CREDITS_USER: {
    id: 'low-credits-user-101',
    email: 'low@test.com',
    subscription: 'inactive',
    credits: 1
  }
};

// Mock JWT Tokens (valid for 24 hours)
export const TEST_JWTS = {
  PREMIUM_USER: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJwcmVtaXVtLXVzZXItMTIzIiwiZW1haWwiOiJwcmVtaXVtQHRlc3QuY29tIiwiaXNzIjoibWFpbmxpbmUiLCJpYXQiOjE3MzQ5NzI4MDAsImV4cCI6MTczNTA1OTIwMH0.premium-signature',
  CREDIT_USER: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjcmVkaXQtdXNlci00NTYiLCJlbWFpbCI6ImNyZWRpdEB0ZXN0LmNvbSIsImlzcyI6Im1haW5saW5lIiwiaWF0IjoxNzM0OTcyODAwLCJleHAiOjE3MzUwNTkyMDB9.credit-signature',
  FREE_USER: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmcmVlLXVzZXItNzg5IiwiZW1haWwiOiJmcmVlQHRlc3QuY29tIiwiaXNzIjoibWFpbmxpbmUiLCJpYXQiOjE3MzQ5NzI4MDAsImV4cCI6MTczNTA1OTIwMH0.free-signature',
  LOW_CREDITS_USER: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJsb3ctY3JlZGl0cy11c2VyLTEwMSIsImVtYWlsIjoibG93QHRlc3QuY29tIiwiaXNzIjoibWFpbmxpbmUiLCJpYXQiOjE3MzQ5NzI4MDAsImV4cCI6MTczNTA1OTIwMH0.low-credits-signature',
  INVALID_JWT: 'invalid.jwt.token',
  EXPIRED_JWT: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJleHBpcmVkLXVzZXIiLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTYwMDAwMDAwMH0.expired-signature'
};

// Test Ad Requests
export const TEST_AD_REQUESTS = {
  BANNER_AD: {
    page: 'test-page',
    format: 'banner',
    sessionId: 'test-session-123',
    deviceType: 'desktop'
  },
  VIDEO_AD: {
    page: 'test-page',
    format: 'video',
    sessionId: 'test-session-456',
    deviceType: 'mobile'
  }
};

// Test Credit Operations
export const TEST_CREDIT_OPERATIONS = {
  DEDUCT_1_CREDIT: {
    amount: 1,
    reason: 'ad_skip'
  },
  REWARD_1_CREDIT: {
    amount: 1,
    reason: 'ad_watch'
  },
  DEDUCT_5_CREDITS: {
    amount: 5,
    reason: 'bulk_skip'
  }
};

// Expected Responses
export const EXPECTED_RESPONSES = {
  AD_SKIP_SUCCESS: {
    success: true,
    ad: null,
    skipReason: 'premium_or_credits'
  },
  AD_SHOW_SUCCESS: {
    success: true,
    ad: {
      id: 'test-ad-123',
      type: 'banner',
      content: 'Test Ad Content'
    }
  },
  CREDITS_STATUS_SUCCESS: {
    success: true,
    data: {
      user_id: 'test-user',
      credits_balance: 5,
      is_premium: false,
      can_skip_ads: true
    }
  },
  CREDITS_DEDUCT_SUCCESS: {
    success: true,
    data: {
      user_id: 'test-user',
      credits_balance: 4,
      is_premium: false,
      deducted_amount: 1,
      reason: 'ad_skip'
    }
  },
  INSUFFICIENT_CREDITS_ERROR: {
    success: false,
    error: 'Insufficient credits'
  },
  INVALID_JWT_ERROR: {
    success: false,
    error: 'Invalid or expired JWT'
  }
};

// Test Scenarios
export const TEST_SCENARIOS = {
  PREMIUM_USER_AD_REQUEST: {
    description: 'Premium user requests ad - should skip',
    user: TEST_USERS.PREMIUM_USER,
    jwt: TEST_JWTS.PREMIUM_USER,
    expectedResult: 'skip_ad'
  },
  CREDIT_USER_AD_REQUEST: {
    description: 'User with credits requests ad - should skip and deduct',
    user: TEST_USERS.CREDIT_USER,
    jwt: TEST_JWTS.CREDIT_USER,
    expectedResult: 'skip_ad_deduct_credit'
  },
  FREE_USER_AD_REQUEST: {
    description: 'Free user requests ad - should show ad',
    user: TEST_USERS.FREE_USER,
    jwt: TEST_JWTS.FREE_USER,
    expectedResult: 'show_ad'
  },
  LOW_CREDITS_USER_AD_REQUEST: {
    description: 'User with 1 credit requests ad - should skip and deduct',
    user: TEST_USERS.LOW_CREDITS_USER,
    jwt: TEST_JWTS.LOW_CREDITS_USER,
    expectedResult: 'skip_ad_deduct_credit'
  }
};

// Network Test Scenarios
export const NETWORK_TEST_SCENARIOS = {
  PAYMENT_SERVICE_DOWN: {
    description: 'Payment service unavailable - should show ad',
    paymentServiceStatus: 'down',
    expectedResult: 'show_ad_fallback'
  },
  PAYMENT_SERVICE_SLOW: {
    description: 'Payment service slow response - should timeout and show ad',
    paymentServiceStatus: 'slow',
    timeout: 2000,
    expectedResult: 'show_ad_timeout'
  },
  PAYMENT_SERVICE_ERROR: {
    description: 'Payment service returns error - should show ad',
    paymentServiceStatus: 'error',
    expectedResult: 'show_ad_fallback'
  }
};

// Test Configuration
export const TEST_CONFIG = {
  PAYMENT_SERVICE_URL: 'http://127.0.0.1:8790',
  AD_SERVICE_URL: 'http://127.0.0.1:8791',
  JWT_SECRET: TEST_JWT_SECRET,
  TIMEOUT: 5000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000
};

// Mock Ad Data
export const MOCK_AD_DATA = {
  BANNER: {
    id: 'banner-ad-123',
    type: 'banner',
    content: 'Test Banner Ad',
    width: 728,
    height: 90,
    clickUrl: 'https://example.com/banner-click'
  },
  VIDEO: {
    id: 'video-ad-456',
    type: 'video',
    content: 'Test Video Ad',
    duration: 30,
    clickUrl: 'https://example.com/video-click'
  }
};

// Test Database States
export const TEST_DB_STATES = {
  INITIAL: {
    'premium-user-123': { credits: 0, is_premium: true },
    'credit-user-456': { credits: 5, is_premium: false },
    'free-user-789': { credits: 0, is_premium: false },
    'low-credits-user-101': { credits: 1, is_premium: false }
  },
  AFTER_DEDUCTION: {
    'premium-user-123': { credits: 0, is_premium: true },
    'credit-user-456': { credits: 4, is_premium: false },
    'free-user-789': { credits: 0, is_premium: false },
    'low-credits-user-101': { credits: 0, is_premium: false }
  },
  AFTER_REWARD: {
    'premium-user-123': { credits: 0, is_premium: true },
    'credit-user-456': { credits: 6, is_premium: false },
    'free-user-789': { credits: 1, is_premium: false },
    'low-credits-user-101': { credits: 2, is_premium: false }
  }
};

export default {
  TEST_USERS,
  TEST_JWTS,
  TEST_AD_REQUESTS,
  TEST_CREDIT_OPERATIONS,
  EXPECTED_RESPONSES,
  TEST_SCENARIOS,
  NETWORK_TEST_SCENARIOS,
  TEST_CONFIG,
  MOCK_AD_DATA,
  TEST_DB_STATES
};

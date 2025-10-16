/**
 * Monkey-patch to inject mock Stripe for testing
 * This file temporarily modifies the Stripe module loading
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// Create mock Stripe class
class MockStripe {
  constructor(apiKey) {
    console.log('[MOCK-STRIPE] Initialized with test key');
    this.apiKey = apiKey;
  }
  
  get checkout() {
    return {
      sessions: {
        create: async (params) => {
          console.log('[MOCK-STRIPE] checkout.sessions.create', params.metadata?.orderId);
          return {
            id: `cs_test_mock_${Date.now()}`,
            url: `https://checkout.stripe.com/test/mock`,
            customer: params.customer || 'cus_mock_123',
            payment_status: 'unpaid',
            status: 'open'
          };
        }
      }
    };
  }
  
  get customers() {
    return {
      create: async (params) => {
        console.log('[MOCK-STRIPE] customers.create', params.email);
        return {
          id: `cus_mock_${Date.now()}`,
          email: params.email,
          metadata: params.metadata || {}
        };
      }
    };
  }
  
  get subscriptions() {
    return {
      retrieve: async (id) => {
        return {
          id,
          status: 'active',
          customer: 'cus_mock_123'
        };
      },
      update: async (id, params) => {
        return {
          id,
          ...params,
          status: 'active'
        };
      }
    };
  }
}

// Export as default like the real Stripe module
export default MockStripe;


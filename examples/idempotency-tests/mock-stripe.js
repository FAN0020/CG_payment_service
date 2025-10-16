// Mock Stripe module for testing without real API keys
let mockCustomerCounter = 1;
let mockSubscriptionCounter = 1;
let mockInvoiceCounter = 1;
let mockSessionCounter = 1;

class MockStripe {
  constructor(apiKey) {
    console.log('[MOCK-STRIPE] Initialized with key:', apiKey?.substring(0, 10) + '...');
    
    this.checkout = {
      sessions: {
        create: async (params) => {
          console.log('[MOCK-STRIPE] checkout.sessions.create called:', JSON.stringify(params, null, 2));
          const session = {
            id: `cs_mock_${mockSessionCounter++}`,
            url: `https://checkout.stripe.com/pay/cs_mock_${mockSessionCounter}`,
            customer: params.customer || `cus_mock_${mockCustomerCounter}`,
            payment_status: 'unpaid',
            status: 'open',
            metadata: params.metadata || {}
          };
          console.log('[MOCK-STRIPE] Created checkout session:', session.id);
          return session;
        }
      }
    };
    
    this.customers = {
      create: async (params) => {
        console.log('[MOCK-STRIPE] customers.create called:', params);
        const customer = {
          id: `cus_mock_${mockCustomerCounter++}`,
          email: params.email,
          metadata: params.metadata || {}
        };
        console.log('[MOCK-STRIPE] Created customer:', customer.id);
        return customer;
      },
      retrieve: async (customerId) => {
        console.log('[MOCK-STRIPE] customers.retrieve called:', customerId);
        return {
          id: customerId,
          email: 'test@example.com',
          metadata: {}
        };
      }
    };

    this.subscriptions = {
      create: async (params) => {
        console.log('[MOCK-STRIPE] subscriptions.create called:', JSON.stringify(params, null, 2));
        const subscription = {
          id: `sub_mock_${mockSubscriptionCounter++}`,
          customer: params.customer,
          status: 'active',
          items: {
            data: [{
              id: 'si_mock_1',
              price: {
                id: params.items[0].price,
                currency: 'usd',
                unit_amount: 999
              }
            }]
          },
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
          metadata: params.metadata || {}
        };
        console.log('[MOCK-STRIPE] Created subscription:', subscription.id);
        return subscription;
      },
      retrieve: async (subscriptionId) => {
        console.log('[MOCK-STRIPE] subscriptions.retrieve called:', subscriptionId);
        return {
          id: subscriptionId,
          customer: 'cus_mock_1',
          status: 'active',
          items: {
            data: [{
              id: 'si_mock_1',
              price: {
                id: 'price_mock_monthly',
                currency: 'usd',
                unit_amount: 999
              }
            }]
          },
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
          metadata: {}
        };
      },
      update: async (subscriptionId, params) => {
        console.log('[MOCK-STRIPE] subscriptions.update called:', subscriptionId, params);
        return {
          id: subscriptionId,
          customer: 'cus_mock_1',
          status: params.status || 'active',
          items: {
            data: [{
              id: 'si_mock_1',
              price: {
                id: params.items?.[0]?.price || 'price_mock_monthly',
                currency: 'usd',
                unit_amount: 999
              }
            }]
          },
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
          metadata: params.metadata || {}
        };
      }
    };

    this.invoices = {
      create: async (params) => {
        console.log('[MOCK-STRIPE] invoices.create called:', params);
        const invoice = {
          id: `inv_mock_${mockInvoiceCounter++}`,
          customer: params.customer,
          subscription: params.subscription,
          status: 'paid',
          amount_paid: 999,
          currency: 'usd'
        };
        console.log('[MOCK-STRIPE] Created invoice:', invoice.id);
        return invoice;
      }
    };
  }
}

module.exports = MockStripe;


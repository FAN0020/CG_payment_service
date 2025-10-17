#!/usr/bin/env node

/**
 * Payment Verification Guide
 * Shows parameters transferred and verification methods
 */

const sqlite3 = require('better-sqlite3');

console.log('\n=================================================');
console.log('   PAYMENT FLOW - Parameters & Verification');
console.log('=================================================\n');

// STEP 1
console.log('📤 STEP 1: Client → Backend (Create Subscription)\n');
console.log('Endpoint: POST /api/payment/create-subscription\n');

console.log('Parameters sent:');
console.log(JSON.stringify({
  jwt: '<JWT_TOKEN>',
  idempotency_key: 'unique_' + Date.now(),
  payment_gateway: 'stripe',
  product_id: 'monthly-plan',
  currency: 'SGD',
  payment_method: 'card',
  customer_email: 'user@example.com',
  platform: 'web',
  client_ref: 'optional_reference'
}, null, 2));

// STEP 2
console.log('\n\n📥 STEP 2: Backend → Client (Session Response)\n');

console.log('Parameters returned:');
console.log(JSON.stringify({
  status_code: 200,
  message: 'Checkout session created successfully',
  data: {
    checkout_url: 'https://checkout.stripe.com/pay/cs_live_xxx',
    order_id: 'ord_xxxxxxxxxx',
    session_id: 'cs_live_xxx'
  }
}, null, 2));

console.log('\n💡 Key points:');
console.log('  • checkout_url: Redirect user here');
console.log('  • order_id: Track this to verify payment');
console.log('  • session_id: Stripe session identifier');

// STEP 3
console.log('\n\n💳 STEP 3: User Completes Payment\n');

console.log('User flow:');
console.log('  1. User redirected to checkout_url (Stripe Checkout)');
console.log('  2. User enters payment details on Stripe');
console.log('  3. User completes payment');
console.log('  4. Redirects to success URL with params:');
console.log('     session_id=cs_xxx&order_id=ord_xxx');

// STEP 4
console.log('\n\n🔔 STEP 4: Stripe → Backend Webhook\n');

console.log('Webhook event:');
console.log(JSON.stringify({
  id: 'evt_xxxxxxxxxx',
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_live_xxx',
      metadata: { order_id: 'ord_xxxxxxxxxx' },
      subscription: 'sub_xxxxxxxxxx',
      customer: 'cus_xxxxxxxxxx'
    }
  }
}, null, 2));

console.log('\n💡 Webhook processing:');
console.log('  1. Finds order using metadata.order_id');
console.log('  2. Updates status: pending → active');
console.log('  3. Saves subscription and customer IDs');
console.log('  4. Records event ID (idempotency)');

// STEP 5
console.log('\n\n✅ STEP 5: Verification Methods\n');

console.log('METHOD 1: Check Database\n');
console.log('SELECT order_id, user_id, status, amount, currency,');
console.log('       stripe_subscription_id, stripe_customer_id');
console.log('FROM orders');
console.log('WHERE user_id = \'USER_ID\' AND status = \'active\';');

try {
  const db = new sqlite3('data/payments.db');
  const orders = db.prepare(`
    SELECT order_id, user_id, status, amount, currency,
           stripe_subscription_id, created_at
    FROM orders 
    ORDER BY created_at DESC 
    LIMIT 3
  `).all();

  if (orders.length > 0) {
    console.log('\n📊 Recent orders in database:');
    console.table(orders);
  } else {
    console.log('\n⚠️  No orders in database yet');
  }
  db.close();
} catch (error) {
  console.log(`\n⚠️  Database not ready: ${error.message}`);
  console.log('   (Will be created on first payment)');
}

console.log('\n\nMETHOD 2: Verification API\n');
console.log('POST /api/payment/verify-subscription');
console.log('\nRequest:', JSON.stringify({ jwt: '<USER_JWT>' }, null, 2));

console.log('\nResponse (active):');
console.log(JSON.stringify({
  status_code: 200,
  data: {
    is_active: true,
    subscription: {
      order_id: 'ord_xxx',
      status: 'active',
      amount: 990,
      currency: 'SGD'
    }
  }
}, null, 2));

// CHECKLIST
console.log('\n\n📋 VERIFICATION CHECKLIST\n');

const checks = [
  'Order exists in database',
  'Order status = "active"',
  'Correct user_id',
  'Correct amount (990 for monthly)',
  'Correct currency (SGD)',
  'stripe_subscription_id saved',
  'stripe_customer_id saved',
  'Webhook event recorded'
];

checks.forEach((check, i) => {
  console.log(`  ${i + 1}. ✓ ${check}`);
});

// COMMON ISSUES  
console.log('\n\n⚠️  COMMON ISSUES\n');

console.log('1. Order pending after payment');
console.log('   → Webhook not received');
console.log('   → Check session metadata has order_id\n');

console.log('2. No order created');
console.log('   → API call failed');
console.log('   → Check logs and parameters\n');

console.log('3. Wrong amount/currency');
console.log('   → Product config mismatch');
console.log('   → Verify product_id\n');

// TESTING
console.log('\n📝 QUICK TESTING\n');

console.log('1. Browser test:');
console.log('   http://localhost:8790/payment');
console.log('   → Click Subscribe');
console.log('   → Complete Payment\n');

console.log('2. Check database:');
console.log('   sqlite3 data/payments.db "SELECT * FROM orders;")\n');

console.log('3. View logs:');
console.log('   Check console output for webhook events\n');

console.log('=================================================');
console.log('✅ Ready to verify payments!');
console.log('=================================================\n');

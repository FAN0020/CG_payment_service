/**
 * ClassGuru Payment Frontend
 * Handles plan selection and payment initiation
 */

// Configuration
const API_BASE_URL = window.location.origin;
const PAYMENT_ENDPOINT = `${API_BASE_URL}/api/payment/create-subscription`;

console.log('='.repeat(80));
console.log('ClassGuru Payment Demo - Frontend Initialized');
console.log('='.repeat(80));
console.log('API Base URL:', API_BASE_URL);
console.log('Payment Endpoint:', PAYMENT_ENDPOINT);
console.log('='.repeat(80));

// Utility function to generate UUID v4
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Show error message
function showError(planType, message) {
  const errorElement = document.getElementById(`error-${planType}`);
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.classList.add('show');
    
    console.error(`[ERROR] ${planType.toUpperCase()}:`, message);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      errorElement.classList.remove('show');
    }, 5000);
  }
}

// Hide error message
function hideError(planType) {
  const errorElement = document.getElementById(`error-${planType}`);
  if (errorElement) {
    errorElement.classList.remove('show');
  }
}

// Get or create JWT token (for demo purposes)
function getJWTToken() {
  let jwt = localStorage.getItem('cg_demo_jwt');
  
  if (!jwt) {
    console.log('[AUTH] No JWT found in localStorage');
    
    // For demo purposes, use a test JWT or prompt user to login
    jwt = prompt(
      'Enter your JWT token (or leave empty to use demo mode):\n\n' +
      'In production, users will be authenticated through your main app.\n\n' +
      'To generate a test JWT, run: npm run generate-jwt'
    );
    
    if (!jwt || jwt.trim() === '') {
      alert(
        'Demo mode: In production, you need a valid JWT from your authentication system.\n\n' +
        'Please configure JWT_SECRET in your .env file and generate a proper JWT token.\n\n' +
        'Run: npm run generate-jwt'
      );
      jwt = 'DEMO_TOKEN_PLACEHOLDER';
    }
    
    localStorage.setItem('cg_demo_jwt', jwt);
    console.log('[AUTH] JWT stored in localStorage');
  } else {
    console.log('[AUTH] Using existing JWT from localStorage');
  }
  
  return jwt;
}

// Handle payment button click
async function handlePayment(event) {
  const button = event.currentTarget;
  const productId = button.dataset.plan;
  const planType = productId.replace('-plan', '');
  
  console.log('\n' + '='.repeat(80));
  console.log(`[PAYMENT] Initiating payment for: ${productId}`);
  console.log('='.repeat(80));
  
  // Disable button and show loading
  button.disabled = true;
  const originalText = button.innerHTML;
  button.innerHTML = '<span class="loading-spinner"></span> Processing...';
  
  // Hide any previous errors
  hideError(planType);
  
  try {
    // Get JWT token
    const jwt = getJWTToken();
    
    if (jwt === 'DEMO_TOKEN_PLACEHOLDER') {
      throw new Error(
        'Authentication required. Please set up JWT authentication in your application.'
      );
    }
    
    // Generate idempotency key
    const idempotencyKey = generateUUID();
    
    // Prepare request payload
    const payload = {
      jwt: jwt,
      idempotency_key: idempotencyKey,
      product_id: productId,
      currency: button.dataset.currency || 'USD',
      platform: 'web',
      client_ref: 'payment_demo_v1'
    };
    
    console.log('[PAYMENT] Request Payload:');
    console.log('  Product ID:', payload.product_id);
    console.log('  Currency:', payload.currency);
    console.log('  Platform:', payload.platform);
    console.log('  Idempotency Key:', payload.idempotency_key);
    console.log('  JWT (first 20 chars):', payload.jwt.substring(0, 20) + '...');
    
    console.log('\n[PAYMENT] Sending request to:', PAYMENT_ENDPOINT);
    
    // Call payment API
    const startTime = Date.now();
    const response = await fetch(PAYMENT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const responseTime = Date.now() - startTime;
    console.log(`[PAYMENT] Response received in ${responseTime}ms`);
    
    const data = await response.json();
    
    console.log('[PAYMENT] Response Status:', response.status);
    console.log('[PAYMENT] Response Data:', JSON.stringify(data, null, 2));
    
    if (!response.ok) {
      throw new Error(data.message || 'Payment initiation failed');
    }
    
    // Check if we got a checkout URL
    if (data.data && data.data.checkout_url) {
      console.log('[SUCCESS] Checkout session created!');
      console.log('  Order ID:', data.data.order_id);
      console.log('  Session ID:', data.data.session_id);
      console.log('  Checkout URL:', data.data.checkout_url);
      
      // Store order ID for reference
      localStorage.setItem('cg_last_order_id', data.data.order_id);
      localStorage.setItem('cg_last_session_id', data.data.session_id);
      
      console.log('\n[REDIRECT] Redirecting to Stripe Checkout...');
      console.log('='.repeat(80) + '\n');
      
      // Redirect to Stripe Checkout
      window.location.href = data.data.checkout_url;
    } else {
      throw new Error('No checkout URL received from server');
    }
    
  } catch (error) {
    console.error('\n[ERROR] Payment failed:');
    console.error('  Message:', error.message);
    console.error('  Stack:', error.stack);
    console.log('='.repeat(80) + '\n');
    
    showError(planType, error.message || 'An error occurred. Please try again.');
    
    // Re-enable button
    button.disabled = false;
    button.innerHTML = originalText;
  }
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  console.log('[INIT] DOM Content Loaded');
  
  // Attach click handlers to all payment buttons
  const paymentButtons = document.querySelectorAll('.cta-button[data-plan]');
  console.log(`[INIT] Found ${paymentButtons.length} payment buttons`);
  
  paymentButtons.forEach((button, index) => {
    const plan = button.dataset.plan;
    console.log(`  [${index + 1}] ${plan} button attached`);
    button.addEventListener('click', handlePayment);
  });
  
  // Check if we're returning from a successful/cancelled payment
  const urlParams = new URLSearchParams(window.location.search);
  const paymentStatus = urlParams.get('status');
  
  if (paymentStatus === 'success') {
    console.log('[STATUS] Returning from successful payment');
    alert('Payment successful! Thank you for subscribing to ClassGuru.');
    window.history.replaceState({}, document.title, window.location.pathname);
  } else if (paymentStatus === 'cancel') {
    console.log('[STATUS] Returning from cancelled payment');
    alert('Payment was cancelled. Feel free to try again when you\'re ready.');
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  
  console.log('[INIT] ClassGuru Payment Page Ready!');
  console.log('='.repeat(80) + '\n');
});

// Handle page visibility for session timeout
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    console.log('[VISIBILITY] Page hidden - payment in progress may timeout');
  } else {
    console.log('[VISIBILITY] Page visible - ready for interaction');
  }
});


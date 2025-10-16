/**
 * ClassGuru Payment Frontend
 * Handles plan selection and payment initiation
 */

// Configuration
const API_BASE_URL = window.location.origin;
const PAYMENT_ENDPOINT = `${API_BASE_URL}/api/payment/create-subscription`;

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
// In production, this should come from your authentication system
function getJWTToken() {
  // Check if we have a JWT in localStorage
  let jwt = localStorage.getItem('cg_demo_jwt');
  
  if (!jwt) {
    // For demo purposes, use a test JWT or prompt user to login
    // In production, redirect to login page
    const testUserId = `demo_user_${Date.now()}`;
    
    // Note: In production, you should get this from your auth system
    // This is just for demo purposes
    jwt = prompt(
      'Enter your JWT token (or leave empty to use demo mode):\n\n' +
      'In production, users will be authenticated through your main app.'
    );
    
    if (!jwt || jwt.trim() === '') {
      // Generate a demo JWT payload (this won't work with real backend)
      alert(
        'Demo mode: In production, you need a valid JWT from your authentication system.\n\n' +
        'Please configure JWT_SECRET in your .env file and generate a proper JWT token.'
      );
      // Return a placeholder - in real scenario, this should redirect to login
      jwt = 'DEMO_TOKEN_PLACEHOLDER';
    }
    
    localStorage.setItem('cg_demo_jwt', jwt);
  }
  
  return jwt;
}

// Handle payment button click
async function handlePayment(event) {
  const button = event.currentTarget;
  const productId = button.dataset.plan;
  const planType = productId.replace('-plan', '');
  
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
      client_ref: 'payment_page_v1'
    };
    
    console.log('Initiating payment...', { productId, idempotencyKey });
    
    // Call payment API
    const response = await fetch(PAYMENT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Payment initiation failed');
    }
    
    // Check if we got a checkout URL
    if (data.data && data.data.checkout_url) {
      console.log('Redirecting to checkout...', data.data.checkout_url);
      
      // Store order ID for reference
      localStorage.setItem('cg_last_order_id', data.data.order_id);
      
      // Redirect to Stripe Checkout
      window.location.href = data.data.checkout_url;
    } else {
      throw new Error('No checkout URL received from server');
    }
    
  } catch (error) {
    console.error('Payment error:', error);
    showError(planType, error.message || 'An error occurred. Please try again.');
    
    // Re-enable button
    button.disabled = false;
    button.innerHTML = originalText;
  }
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  console.log('ClassGuru Payment Page Initialized');
  
  // Attach click handlers to all payment buttons
  const paymentButtons = document.querySelectorAll('.cta-button[data-plan]');
  paymentButtons.forEach(button => {
    button.addEventListener('click', handlePayment);
  });
  
  // Check if we're returning from a successful/cancelled payment
  const urlParams = new URLSearchParams(window.location.search);
  const paymentStatus = urlParams.get('status');
  
  if (paymentStatus === 'success') {
    alert('Payment successful! Thank you for subscribing to ClassGuru.');
    // Clean up URL
    window.history.replaceState({}, document.title, window.location.pathname);
  } else if (paymentStatus === 'cancel') {
    alert('Payment was cancelled. Feel free to try again when you\'re ready.');
    // Clean up URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }
});

// Handle page visibility for session timeout
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    console.log('Page hidden - payment in progress may timeout');
  } else {
    console.log('Page visible - checking payment status');
    // Could add logic here to verify payment status when user returns
  }
});


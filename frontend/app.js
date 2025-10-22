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

// Show JWT input modal
function showJWTModal() {
  return new Promise((resolve) => {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      backdrop-filter: blur(4px);
    `;
    
    // Create modal
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: white;
      padding: 32px;
      border-radius: 12px;
      max-width: 500px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    `;
    
    modal.innerHTML = `
      <h2 style="margin: 0 0 16px; font-size: 24px; color: #333;">Enter JWT Token</h2>
      <p style="margin: 0 0 20px; color: #666; line-height: 1.5;">
        Please enter your JWT token to continue with the payment.<br>
        <strong>To generate a test JWT, run:</strong> <code style="background: #f5f5f5; padding: 2px 6px; border-radius: 4px;">npm run generate-jwt</code>
      </p>
      <textarea 
        id="jwt-input" 
        placeholder="Paste your JWT token here..."
        style="
          width: 100%;
          min-height: 100px;
          padding: 12px;
          border: 2px solid #ddd;
          border-radius: 8px;
          font-family: monospace;
          font-size: 12px;
          resize: vertical;
          box-sizing: border-box;
        "
      ></textarea>
      <div style="margin-top: 20px; display: flex; gap: 12px; justify-content: flex-end;">
        <button id="jwt-cancel" style="
          padding: 10px 20px;
          border: 2px solid #ddd;
          background: white;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
        ">Cancel</button>
        <button id="jwt-submit" style="
          padding: 10px 20px;
          border: none;
          background: #646cff;
          color: white;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
        ">Continue</button>
      </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    const input = document.getElementById('jwt-input');
    const submitBtn = document.getElementById('jwt-submit');
    const cancelBtn = document.getElementById('jwt-cancel');
    
    input.focus();
    
    submitBtn.onclick = () => {
      const jwt = input.value.trim();
      document.body.removeChild(overlay);
      resolve(jwt);
    };
    
    cancelBtn.onclick = () => {
      document.body.removeChild(overlay);
      resolve(null);
    };
    
    // Allow Enter key to submit if not in textarea
    submitBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        submitBtn.click();
      }
    });
  });
}

// Get or create JWT token (for demo purposes)
async function getJWTToken() {
  let jwt = localStorage.getItem('cg_demo_jwt');
  
  if (!jwt) {
    console.log('[AUTH] No JWT found in localStorage');
    
    // Show modal to get JWT
    jwt = await showJWTModal();
    
    if (!jwt) {
      throw new Error('JWT token is required to proceed with payment');
    }
    
    localStorage.setItem('cg_demo_jwt', jwt);
    console.log('[AUTH] JWT stored in localStorage');
    
    // Update UI
    updateJWTStatus();
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
    const jwt = await getJWTToken();
    
    if (!jwt) {
      throw new Error('JWT token is required to proceed with payment');
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
    
    // Handle 409 Conflict - Payment already in progress
    if (response.status === 409) {
      console.log('[CONFLICT] Payment already in progress');
      console.log('  Message:', data.message);
      console.log('  Retry After:', data.data?.retry_after, 'seconds');
      console.log('  Session URL:', data.data?.session_url);
      
      // Show user-friendly message
      const retryAfter = data.data?.retry_after || 5;
      const sessionUrl = data.data?.session_url;
      
      if (sessionUrl) {
        // If we have a session URL, redirect to it
        console.log('[REDIRECT] Redirecting to existing checkout session...');
        window.location.href = sessionUrl;
        return;
      } else {
        // Show retry message
        showError(planType, `Payment is already in progress. Please wait ${retryAfter} seconds before trying again.`);
        
        // Re-enable button after retry period
        setTimeout(() => {
          button.disabled = false;
          button.innerHTML = originalText;
        }, retryAfter * 1000);
        return;
      }
    }
    
    if (!response.ok) {
      throw new Error(data.message || 'Payment initiation failed');
    }
    
    // Check if we got a checkout URL
    if (data.data && data.data.checkout_url) {
      console.log('[SUCCESS] Checkout session created!');
      console.log('  Order ID:', data.data.order_id);
      console.log('  Session ID:', data.data.session_id);
      console.log('  Checkout URL:', data.data.checkout_url);
      
      // Store order ID and plan type for reference
      localStorage.setItem('cg_last_order_id', data.data.order_id);
      localStorage.setItem('cg_last_session_id', data.data.session_id);
      localStorage.setItem('cg_last_plan_type', planType);
      
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

// Update JWT status indicator
function updateJWTStatus() {
  const jwt = localStorage.getItem('cg_demo_jwt');
  const statusText = document.getElementById('jwt-status-text');
  const clearBtn = document.getElementById('clear-jwt-btn');
  const statusContainer = document.getElementById('jwt-status');
  
  if (jwt) {
    statusText.textContent = '✓ JWT token stored';
    statusText.style.color = '#22c55e';
    statusContainer.style.background = '#f0fdf4';
    statusContainer.style.border = '2px solid #22c55e';
    clearBtn.style.display = 'block';
  } else {
    statusText.textContent = 'No JWT token stored';
    statusText.style.color = '#666';
    statusContainer.style.background = '#f5f5f5';
    statusContainer.style.border = '2px solid #ddd';
    clearBtn.style.display = 'none';
  }
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  console.log('[INIT] DOM Content Loaded');
  
  // Update JWT status
  updateJWTStatus();
  
  // Attach click handler to clear JWT button
  const clearJWTBtn = document.getElementById('clear-jwt-btn');
  if (clearJWTBtn) {
    clearJWTBtn.addEventListener('click', () => {
      localStorage.removeItem('cg_demo_jwt');
      updateJWTStatus();
      console.log('[AUTH] JWT cleared from localStorage');
      alert('JWT token cleared. You will be prompted to enter a new token on your next payment.');
    });
  }
  
  // Attach click handlers to all payment buttons
  const paymentButtons = document.querySelectorAll('.cg-button[data-plan]');
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






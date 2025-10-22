/**
 * ClassGuru Payment Result Page - Comprehensive Handler
 * Handles success, failure, timeout, and all payment scenarios
 */

console.log('='.repeat(80));
console.log('ClassGuru Payment Result Page - Comprehensive Handler');
console.log('='.repeat(80));

// Configuration
const CONFIG = {
  TIMEOUT_DURATION: 60000, // 1 minute timeout
  POLL_INTERVAL: 2000,     // Poll every 2 seconds
  MAX_POLL_ATTEMPTS: 30,   // Maximum polling attempts
  API_BASE_URL: 'http://localhost:8790'
};

// Payment result states
const PAYMENT_STATES = {
  SUCCESS: 'success',
  FAILED: 'failed',
  TIMEOUT: 'timeout',
  PENDING: 'pending',
  CANCELLED: 'cancelled',
  ERROR: 'error'
};

// Global state
let paymentState = PAYMENT_STATES.PENDING;
let pollAttempts = 0;
let timeoutId = null;
let pollIntervalId = null;

// Initialize result page
document.addEventListener('DOMContentLoaded', () => {
  console.log('[INIT] Comprehensive result page loaded');
  
  // Get URL parameters from Stripe redirect
  const urlParams = new URLSearchParams(window.location.search);
  const sessionIdFromUrl = urlParams.get('session_id');
  const successFromUrl = urlParams.get('success');
  const cancelledFromUrl = urlParams.get('cancelled');
  
  console.log('[INFO] URL Parameters:');
  console.log('  session_id:', sessionIdFromUrl || 'Not found');
  console.log('  success:', successFromUrl || 'Not found');
  console.log('  cancelled:', cancelledFromUrl || 'Not found');
  
  // Get stored order information
  const orderId = localStorage.getItem('cg_last_order_id');
  const sessionId = localStorage.getItem('cg_last_session_id');
  const planType = localStorage.getItem('cg_last_plan_type');
  
  console.log('[INFO] Stored Information:');
  console.log('  Order ID:', orderId || 'Not found');
  console.log('  Session ID:', sessionId || 'Not found');
  console.log('  Plan Type:', planType || 'Not found');
  
  // Determine initial state based on URL parameters
  if (cancelledFromUrl === 'true') {
    handlePaymentResult(PAYMENT_STATES.CANCELLED, {
      orderId,
      sessionId: sessionIdFromUrl || sessionId,
      planType,
      error: 'Payment was cancelled by user'
    });
  } else if (successFromUrl === 'true' && sessionIdFromUrl) {
    // Start polling for payment status
    startPaymentStatusPolling(sessionIdFromUrl, orderId, planType);
  } else {
    // Unknown state, start polling with stored data
    startPaymentStatusPolling(sessionIdFromUrl || sessionId, orderId, planType);
  }
  
  // Set up timeout
  setupTimeout();
  
  console.log('[INIT] Result page ready');
  console.log('='.repeat(80) + '\n');
});

/**
 * Set up timeout handling
 */
function setupTimeout() {
  timeoutId = setTimeout(() => {
    console.log('[TIMEOUT] Payment verification timed out');
    
    if (paymentState === PAYMENT_STATES.PENDING) {
      handlePaymentResult(PAYMENT_STATES.TIMEOUT, {
        error: 'Payment verification timed out after 1 minute',
        timeout: true
      });
    }
  }, CONFIG.TIMEOUT_DURATION);
}

/**
 * Start polling for payment status
 */
function startPaymentStatusPolling(sessionId, orderId, planType) {
  if (!sessionId) {
    console.log('[ERROR] No session ID available for polling');
    handlePaymentResult(PAYMENT_STATES.ERROR, {
      error: 'No session ID available for verification'
    });
    return;
  }
  
  console.log('[POLL] Starting payment status polling');
  console.log('  Session ID:', sessionId);
  console.log('  Timeout:', CONFIG.TIMEOUT_DURATION + 'ms');
  
  // Start polling immediately
  pollPaymentStatus(sessionId, orderId, planType);
  
  // Set up interval polling
  pollIntervalId = setInterval(() => {
    pollPaymentStatus(sessionId, orderId, planType);
  }, CONFIG.POLL_INTERVAL);
}

/**
 * Poll payment status from server
 */
async function pollPaymentStatus(sessionId, orderId, planType) {
  pollAttempts++;
  
  if (pollAttempts > CONFIG.MAX_POLL_ATTEMPTS) {
    console.log('[POLL] Maximum polling attempts reached');
    clearPolling();
    handlePaymentResult(PAYMENT_STATES.TIMEOUT, {
      error: 'Maximum polling attempts reached',
      timeout: true
    });
    return;
  }
  
  console.log(`[POLL] Attempt ${pollAttempts}/${CONFIG.MAX_POLL_ATTEMPTS}`);
  
  try {
    // Try to get payment status from server
    const response = await fetch(`${CONFIG.API_BASE_URL}/api/payment/status/${sessionId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const responseData = await response.json();
      console.log('[POLL] Server response:', responseData);
      
      // Extract data from the API response structure
      const data = responseData.data || {};
      const status = data.status;
      
      if (status === 'completed' || status === 'success') {
        clearPolling();
        handlePaymentResult(PAYMENT_STATES.SUCCESS, {
          orderId: data.order_id || orderId,
          sessionId: data.session_id || sessionId,
          planType: data.plan || planType,
          amount: data.amount,
          currency: data.currency
        });
      } else if (status === 'failed' || status === 'error') {
        clearPolling();
        handlePaymentResult(PAYMENT_STATES.FAILED, {
          orderId: data.order_id || orderId,
          sessionId: data.session_id || sessionId,
          planType: data.plan || planType,
          error: data.error || 'Payment failed'
        });
      }
      // Continue polling for other statuses
    } else {
      console.log('[POLL] Server error:', response.status, response.statusText);
      // Continue polling on server errors
    }
  } catch (error) {
    console.log('[POLL] Network error:', error.message);
    // Continue polling on network errors
  }
}

/**
 * Clear polling and timeout
 */
function clearPolling() {
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
}

/**
 * Handle payment result and update UI
 */
function handlePaymentResult(state, data = {}) {
  paymentState = state;
  clearPolling();
  
  console.log(`[RESULT] Payment state: ${state}`);
  console.log('[RESULT] Data:', data);
  
  // Update UI based on state
  updateUI(state, data);
  
  // Clear stored data after processing
  if (state === PAYMENT_STATES.SUCCESS || state === PAYMENT_STATES.FAILED) {
    localStorage.removeItem('cg_last_order_id');
    localStorage.removeItem('cg_last_session_id');
    localStorage.removeItem('cg_last_plan_type');
    console.log('[CLEANUP] Cleared stored payment data');
  }
}

/**
 * Update UI based on payment result
 */
function updateUI(state, data) {
  const iconElement = document.getElementById('result-icon');
  const iconTextElement = document.getElementById('icon-text');
  const titleElement = document.getElementById('result-title');
  const messageElement = document.getElementById('result-message');
  const statusIndicatorElement = document.getElementById('status-indicator');
  const statusValueElement = document.getElementById('status-value');
  const timeoutWarningElement = document.getElementById('timeout-warning');
  const errorDetailsElement = document.getElementById('error-details');
  const actionButtonsElement = document.getElementById('action-buttons');
  const additionalInfoElement = document.getElementById('additional-info');
  
  // Update icon and styling
  iconElement.className = `result-icon ${state}`;
  
  // Update content based on state
  switch (state) {
    case PAYMENT_STATES.SUCCESS:
      iconTextElement.textContent = '✓';
      titleElement.textContent = 'Payment Successful!';
      messageElement.textContent = 'Thank you for subscribing to ClassGuru. Your payment has been processed successfully.';
      statusIndicatorElement.className = 'status-indicator success';
      statusIndicatorElement.innerHTML = '<span>✓ Completed</span>';
      statusValueElement.textContent = 'Completed';
      statusValueElement.style.color = 'var(--cg-success)';
      statusValueElement.style.fontWeight = '600';
      
      // Show success buttons
      actionButtonsElement.innerHTML = `
        <a href="/payment" class="cg-button secondary">Back to Plans</a>
        <a href="https://classguru.ai/dashboard" class="cg-button primary">Go to Dashboard</a>
      `;
      
      additionalInfoElement.innerHTML = `
        <p style="margin-bottom: 8px;">A confirmation email has been sent to your registered email address.</p>
        <p class="mb-0">If you have any questions, please contact our support team.</p>
      `;
      break;
      
    case PAYMENT_STATES.FAILED:
      iconTextElement.textContent = '✗';
      titleElement.textContent = 'Payment Failed';
      messageElement.textContent = 'Unfortunately, your payment could not be processed. Please try again or contact support.';
      statusIndicatorElement.className = 'status-indicator error';
      statusIndicatorElement.innerHTML = '<span>✗ Failed</span>';
      statusValueElement.textContent = 'Failed';
      statusValueElement.style.color = 'var(--cg-error)';
      statusValueElement.style.fontWeight = '600';
      
      // Show error details if available
      if (data.error) {
        errorDetailsElement.classList.remove('hidden');
        document.getElementById('error-message').textContent = data.error;
      }
      
      // Show retry buttons
      actionButtonsElement.innerHTML = `
        <a href="/payment" class="cg-button primary">Try Again</a>
        <a href="mailto:support@classguru.ai" class="cg-button secondary">Contact Support</a>
      `;
      
      additionalInfoElement.innerHTML = `
        <p style="margin-bottom: 8px; font-weight: 600; color: var(--cg-text);">Need help?</p>
        <p class="mb-0">Our support team is here to assist you. Common issues include insufficient funds, expired cards, or network problems.</p>
      `;
      break;
      
    case PAYMENT_STATES.TIMEOUT:
      iconTextElement.textContent = '⏰';
      titleElement.textContent = 'Payment Timeout';
      messageElement.textContent = 'Your payment is taking longer than expected. This usually means the payment is still being processed.';
      statusIndicatorElement.className = 'status-indicator timeout';
      statusIndicatorElement.innerHTML = '<span>⏰ Timeout</span>';
      statusValueElement.textContent = 'Timeout';
      statusValueElement.style.color = 'var(--cg-warning)';
      statusValueElement.style.fontWeight = '600';
      
      // Show timeout warning
      timeoutWarningElement.classList.remove('hidden');
      
      // Show timeout buttons
      actionButtonsElement.innerHTML = `
        <a href="/payment" class="cg-button primary">Check Status</a>
        <a href="mailto:support@classguru.ai" class="cg-button secondary">Contact Support</a>
      `;
      
      additionalInfoElement.innerHTML = `
        <p style="margin-bottom: 8px; font-weight: 600; color: var(--cg-text);">What should you do?</p>
        <p class="mb-0">Check your email for payment confirmation, or contact support if you don't receive confirmation within 10 minutes.</p>
      `;
      break;
      
    case PAYMENT_STATES.CANCELLED:
      iconTextElement.textContent = '!';
      titleElement.textContent = 'Payment Cancelled';
      messageElement.textContent = 'Your payment was cancelled. No charges have been made to your account.';
      statusIndicatorElement.className = 'status-indicator cancel';
      statusIndicatorElement.innerHTML = '<span>! Cancelled</span>';
      statusValueElement.textContent = 'Cancelled';
      statusValueElement.style.color = 'var(--cg-muted)';
      statusValueElement.style.fontWeight = '600';
      
      // Show cancel buttons
      actionButtonsElement.innerHTML = `
        <a href="/payment" class="cg-button primary">Try Again</a>
        <a href="mailto:support@classguru.ai" class="cg-button secondary">Contact Support</a>
      `;
      
      additionalInfoElement.innerHTML = `
        <p style="margin-bottom: 8px; font-weight: 600; color: var(--cg-text);">Need help choosing a plan?</p>
        <p class="mb-0">Our support team is here to assist you. Feel free to reach out if you have any questions.</p>
      `;
      break;
      
    case PAYMENT_STATES.ERROR:
    default:
      iconTextElement.textContent = '?';
      titleElement.textContent = 'Payment Error';
      messageElement.textContent = 'An unexpected error occurred while processing your payment. Please contact support.';
      statusIndicatorElement.className = 'status-indicator error';
      statusIndicatorElement.innerHTML = '<span>? Error</span>';
      statusValueElement.textContent = 'Error';
      statusValueElement.style.color = 'var(--cg-error)';
      statusValueElement.style.fontWeight = '600';
      
      // Show error details if available
      if (data.error) {
        errorDetailsElement.classList.remove('hidden');
        document.getElementById('error-message').textContent = data.error;
      }
      
      // Show error buttons
      actionButtonsElement.innerHTML = `
        <a href="/payment" class="cg-button primary">Try Again</a>
        <a href="mailto:support@classguru.ai" class="cg-button secondary">Contact Support</a>
      `;
      
      additionalInfoElement.innerHTML = `
        <p style="margin-bottom: 8px; font-weight: 600; color: var(--cg-text);">Technical Support</p>
        <p class="mb-0">If this error persists, please contact our technical support team with the error details above.</p>
      `;
      break;
  }
  
  // Update order details
  updateOrderDetails(data);
}

/**
 * Update order details section
 */
function updateOrderDetails(data) {
  const orderIdElement = document.getElementById('order-id');
  const sessionIdElement = document.getElementById('session-id');
  const planNameElement = document.getElementById('plan-name');
  const amountElement = document.getElementById('amount-value');
  
  if (orderIdElement) {
    orderIdElement.textContent = data.orderId || 'Not available';
  }
  
  if (sessionIdElement) {
    sessionIdElement.textContent = data.sessionId || 'Not available';
  }
  
  if (planNameElement) {
    const planDisplayName = data.planType === 'trial' ? 'Trial Plan ($1 for 2 days)' : 
                           data.planType === 'monthly' ? 'Monthly Plan ($12.90/month)' : 
                           'Unknown Plan';
    planNameElement.textContent = planDisplayName;
  }
  
  if (amountElement) {
    if (data.amount && data.currency) {
      amountElement.textContent = `${data.currency.toUpperCase()} ${data.amount}`;
    } else {
      amountElement.textContent = 'Not available';
    }
  }
}

// Log button clicks for debugging
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('cg-button')) {
    const href = e.target.getAttribute('href');
    const text = e.target.textContent;
    console.log('[CLICK] Button clicked:', href || text);
  }
});

// Handle page visibility change (pause/resume polling)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    console.log('[VISIBILITY] Page hidden - pausing polling');
  } else {
    console.log('[VISIBILITY] Page visible - resuming polling');
  }
});

// Handle page unload
window.addEventListener('beforeunload', () => {
  console.log('[UNLOAD] Page unloading - cleaning up');
  clearPolling();
});

console.log('[READY] Comprehensive payment result handler initialized');
console.log('='.repeat(80) + '\n');
/**
 * ClassGuru Payment Result Page
 * Handles success and cancel page interactions
 */

console.log('='.repeat(80));
console.log('ClassGuru Payment Result Page - Initialized');
console.log('='.repeat(80));

// Initialize result page
document.addEventListener('DOMContentLoaded', () => {
  console.log('[INIT] Result page loaded');
  
  // Get stored order information
  const orderId = localStorage.getItem('cg_last_order_id');
  const sessionId = localStorage.getItem('cg_last_session_id');
  
  console.log('[INFO] Stored Order ID:', orderId || 'Not found');
  console.log('[INFO] Stored Session ID:', sessionId || 'Not found');
  
  // Update order details if elements exist
  const orderIdElement = document.getElementById('order-id');
  const sessionIdElement = document.getElementById('session-id');
  
  if (orderIdElement && orderId) {
    orderIdElement.textContent = orderId;
    console.log('[UPDATE] Order ID displayed on page');
  } else if (orderIdElement) {
    orderIdElement.textContent = 'Not available';
  }
  
  if (sessionIdElement && sessionId) {
    sessionIdElement.textContent = sessionId;
    console.log('[UPDATE] Session ID displayed on page');
  } else if (sessionIdElement) {
    sessionIdElement.textContent = 'Not available';
  }
  
  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const sessionIdFromUrl = urlParams.get('session_id');
  
  if (sessionIdFromUrl) {
    console.log('[INFO] Session ID from URL:', sessionIdFromUrl);
    if (sessionIdElement) {
      sessionIdElement.textContent = sessionIdFromUrl;
    }
  }
  
  console.log('[INIT] Result page ready');
  console.log('='.repeat(80) + '\n');
});

// Log button clicks for debugging
document.querySelectorAll('.cta-button').forEach(button => {
  button.addEventListener('click', (e) => {
    const href = button.getAttribute('href');
    console.log('[CLICK] Button clicked:', href || button.textContent);
  });
});


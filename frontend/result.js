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
  
  // Get URL parameters from Stripe redirect
  const urlParams = new URLSearchParams(window.location.search);
  const sessionIdFromUrl = urlParams.get('session_id');
  const successFromUrl = urlParams.get('success');
  
  console.log('[INFO] URL Parameters:');
  console.log('  session_id:', sessionIdFromUrl || 'Not found');
  console.log('  success:', successFromUrl || 'Not found');
  
  // Get stored order information
  const orderId = localStorage.getItem('cg_last_order_id');
  const sessionId = localStorage.getItem('cg_last_session_id');
  const planType = localStorage.getItem('cg_last_plan_type');
  
  console.log('[INFO] Stored Information:');
  console.log('  Order ID:', orderId || 'Not found');
  console.log('  Session ID:', sessionId || 'Not found');
  console.log('  Plan Type:', planType || 'Not found');
  
  // Update order details if elements exist
  const orderIdElement = document.getElementById('order-id');
  const sessionIdElement = document.getElementById('session-id');
  const planNameElement = document.getElementById('plan-name');
  
  // Use session ID from URL if available, otherwise use stored
  const finalSessionId = sessionIdFromUrl || sessionId;
  
  if (orderIdElement) {
    orderIdElement.textContent = orderId || 'Not available';
    console.log('[UPDATE] Order ID displayed on page');
  }
  
  if (sessionIdElement) {
    sessionIdElement.textContent = finalSessionId || 'Not available';
    console.log('[UPDATE] Session ID displayed on page');
  }
  
  if (planNameElement) {
    const planDisplayName = planType === 'trial' ? 'Trial Plan ($1 for 2 days)' : 
                           planType === 'monthly' ? 'Monthly Plan ($12.90/month)' : 
                           'Unknown Plan';
    planNameElement.textContent = planDisplayName;
    console.log('[UPDATE] Plan name displayed on page');
  }
  
  // Clear stored data after successful display
  if (finalSessionId) {
    localStorage.removeItem('cg_last_order_id');
    localStorage.removeItem('cg_last_session_id');
    localStorage.removeItem('cg_last_plan_type');
    console.log('[CLEANUP] Cleared stored payment data');
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






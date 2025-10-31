// ClassGuru Ad Service Demo JavaScript

const API_BASE = window.location.origin;
let sessionId = generateSessionId();
let stats = {
  impressions: 0,
  clicks: 0,
};
let currentImpressionId = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  log('Demo page loaded', 'info');
  // Auto-load an ad on page load
  setTimeout(() => loadAd(), 500);
});

function setupEventListeners() {
  document.getElementById('loadAd').addEventListener('click', loadAd);
  document.getElementById('refreshAd').addEventListener('click', loadAd);
}

async function loadAd() {
  const format = document.getElementById('adFormat').value;
  const deviceType = document.getElementById('deviceType').value;
  const adContainer = document.getElementById('adContainer');

  log(`Requesting ${format} ad for ${deviceType}...`, 'info');

  // Show loading
  adContainer.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading ad...</p>
    </div>
  `;

  try {
    const response = await fetch(`${API_BASE}/api/ads/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        page: '/demo',
        format: format,
        size: getAdSize(format, deviceType),
        sessionId: sessionId,
        deviceType: deviceType,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to load ad');
    }

    // Check if user skipped ads (premium/credits)
    if (data.skipReason) {
      adContainer.innerHTML = `
        <div class="loading">
          <p style="color: #28a745;">✨ Ad skipped (${data.skipReason === 'premium_user' ? 'Premium User' : 'Has Credits'})</p>
        </div>
      `;
      log(`Ad skipped: ${data.skipReason}`, 'info');
      return;
    }

    // Check if ad data is available
    if (data.data && data.data.content) {
      const ad = data.data;
      
      // Display ad
      adContainer.innerHTML = `
        <span class="ad-label">Advertisement</span>
        ${ad.content}
      `;

      // Store impression ID for click tracking
      currentImpressionId = ad.impressionId;

      // Add click listener - find any clickable element in the ad
      setTimeout(() => {
        const adElement = adContainer.querySelector('.mock-ad, a, [onclick]');
        if (adElement) {
          adElement.style.cursor = 'pointer';
          adElement.addEventListener('click', (e) => {
            e.preventDefault();
            trackClick(ad.impressionId, ad.clickUrl);
            // Open URL in new tab after tracking
            if (ad.clickUrl) {
              window.open(ad.clickUrl, '_blank');
            }
          });
        }
      }, 100);

      // Update stats
      stats.impressions++;
      updateStats();

      log(`Ad loaded successfully (ID: ${ad.id || ad.impressionId})`, 'success');
    } else {
      adContainer.innerHTML = `
        <div class="loading">
          <p>No ads available at this time</p>
        </div>
      `;
      log('No ads available', 'info');
    }
  } catch (error) {
    console.error('Error loading ad:', error);
    adContainer.innerHTML = `
      <div class="loading">
        <p style="color: #dc3545;">Failed to load ad: ${error.message}</p>
      </div>
    `;
    log(`Error loading ad: ${error.message}`, 'error');
  }
}

async function trackClick(impressionId, clickUrl) {
  log(`Ad clicked (Impression: ${impressionId})`, 'info');

  try {
    const response = await fetch(`${API_BASE}/api/ads/click`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        impressionId: impressionId,
        clickUrl: clickUrl || 'https://example.com',
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to track click');
    }

    // Update stats
    stats.clicks++;
    updateStats();

    log('Click tracked successfully', 'success');

    // Simulate opening ad URL
    if (clickUrl) {
      log(`Opening URL: ${clickUrl}`, 'info');
      // window.open(clickUrl, '_blank');
    }
  } catch (error) {
    console.error('Error tracking click:', error);
    log(`Error tracking click: ${error.message}`, 'error');
  }
}

function updateStats() {
  document.getElementById('impressionCount').textContent = stats.impressions;
  document.getElementById('clickCount').textContent = stats.clicks;

  const ctr = stats.impressions > 0 
    ? ((stats.clicks / stats.impressions) * 100).toFixed(2) 
    : 0;
  document.getElementById('ctrValue').textContent = `${ctr}%`;
}

function log(message, type = 'info') {
  const logElement = document.getElementById('activityLog');
  const timestamp = new Date().toLocaleTimeString();
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = `[${timestamp}] ${message}`;
  
  logElement.insertBefore(entry, logElement.firstChild);
  
  // Keep only last 50 entries
  while (logElement.children.length > 50) {
    logElement.removeChild(logElement.lastChild);
  }
}

function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getAdSize(format, deviceType) {
  const sizes = {
    banner: {
      desktop: { width: 728, height: 90 },
      mobile: { width: 320, height: 50 },
      tablet: { width: 468, height: 60 },
    },
    rectangle: {
      desktop: { width: 300, height: 250 },
      mobile: { width: 300, height: 250 },
      tablet: { width: 300, height: 250 },
    },
    native: {
      desktop: { width: 600, height: 400 },
      mobile: { width: 320, height: 400 },
      tablet: { width: 468, height: 400 },
    },
  };

  return sizes[format]?.[deviceType] || { width: 300, height: 250 };
}

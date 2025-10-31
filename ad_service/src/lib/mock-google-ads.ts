import { logger } from './logger.js';
import { AD_CONFIG } from '../config/ads.js';
import type { AdRequest, AdResponse } from '../types/index.js';

/**
 * Mock Google Ads system for development and testing
 * Mimics the behavior of real Google Ads without requiring API keys
 */

interface MockAdContent {
  title: string;
  description: string;
  displayUrl: string;
  clickUrl: string;
  imageUrl?: string;
}

const MOCK_ADS: Record<string, MockAdContent[]> = {
  success: [
    {
      title: 'Learn Programming Online',
      description: 'Master coding with our interactive courses. Start learning today!',
      displayUrl: 'www.example-edu.com',
      clickUrl: 'https://example.com/programming',
      imageUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200"%3E%3Crect width="300" height="200" fill="%234A90E2"/%3E%3Ctext x="50%25" y="45%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="48" fill="white"%3E💻%3C/text%3E%3Ctext x="50%25" y="65%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="20" fill="white" font-weight="bold"%3ELearn Code%3C/text%3E%3C/svg%3E',
    },
    {
      title: 'Cloud Hosting Solutions',
      description: 'Reliable and scalable cloud infrastructure for your business.',
      displayUrl: 'www.example-cloud.com',
      clickUrl: 'https://example.com/cloud',
      imageUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200"%3E%3Crect width="300" height="200" fill="%2350E3C2"/%3E%3Ctext x="50%25" y="45%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="48" fill="white"%3E☁️%3C/text%3E%3Ctext x="50%25" y="65%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="20" fill="white" font-weight="bold"%3ECloud Host%3C/text%3E%3C/svg%3E',
    },
    {
      title: 'Business Analytics Tools',
      description: 'Transform your data into insights. Free trial available.',
      displayUrl: 'www.example-analytics.com',
      clickUrl: 'https://example.com/analytics',
      imageUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200"%3E%3Crect width="300" height="200" fill="%23F5A623"/%3E%3Ctext x="50%25" y="45%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="48" fill="white"%3E📊%3C/text%3E%3Ctext x="50%25" y="65%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="20" fill="white" font-weight="bold"%3EAnalytics%3C/text%3E%3C/svg%3E',
    },
  ],
  empty: [],
};

/**
 * Mock Google Ads Manager
 */
class MockGoogleAdsManager {
  private scenario: string;

  constructor() {
    this.scenario = AD_CONFIG.mock.scenario;
    logger.info('Mock Google Ads initialized', { scenario: this.scenario });
  }

  /**
   * Request a mock ad
   */
  async requestAd(request: AdRequest): Promise<AdResponse> {
    logger.info('Mock ad request received', { request, scenario: this.scenario });

    // Simulate network delay
    await this.delay(100);

    switch (this.scenario) {
      case 'success':
        return this.generateSuccessResponse(request);
      
      case 'empty':
        return this.generateEmptyResponse();
      
      case 'error':
        return this.generateErrorResponse();
      
      default:
        return this.generateSuccessResponse(request);
    }
  }

  /**
   * Generate success response with mock ad
   */
  private generateSuccessResponse(request: AdRequest): AdResponse {
    const ads = MOCK_ADS.success;
    const randomAd = ads[Math.floor(Math.random() * ads.length)];
    const impressionId = `mock_imp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const adHTML = this.generateMockAdHTML(randomAd, request);

    return {
      success: true,
      ad: {
        id: `mock_ad_${Date.now()}`,
        type: request.format,
        content: adHTML,
        clickUrl: randomAd.clickUrl,
        impressionId,
      },
    };
  }

  /**
   * Generate empty response (no ads available)
   */
  private generateEmptyResponse(): AdResponse {
    return {
      success: true,
      ad: undefined,
    };
  }

  /**
   * Generate error response
   */
  private generateErrorResponse(): AdResponse {
    return {
      success: false,
      error: 'Mock error: Failed to fetch ad',
    };
  }

  /**
   * Generate HTML for mock ad
   */
  private generateMockAdHTML(ad: MockAdContent, request: AdRequest): string {
    const { width, height } = request.size || { width: 300, height: 250 };

    return `
      <div class="mock-ad" style="
        width: ${width}px;
        height: ${height}px;
        border: 2px dashed #ccc;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        padding: 20px;
        box-sizing: border-box;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        font-family: Arial, sans-serif;
        text-decoration: none;
        cursor: pointer;
        position: relative;
      ">
        <div style="position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.5); padding: 2px 8px; border-radius: 3px; font-size: 10px;">
          MOCK AD
        </div>
        ${ad.imageUrl ? `<img src="${ad.imageUrl}" alt="${ad.title}" style="max-width: 100%; max-height: 60%; margin-bottom: 10px; border-radius: 4px;">` : ''}
        <div style="text-align: center;">
          <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: bold;">${ad.title}</h3>
          <p style="margin: 0 0 8px 0; font-size: 14px; opacity: 0.9;">${ad.description}</p>
          <span style="font-size: 12px; opacity: 0.8; font-style: italic;">${ad.displayUrl}</span>
        </div>
      </div>
    `;
  }

  /**
   * Simulate network delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get mock AdSense configuration
   */
  getAdSenseConfig() {
    return {
      clientId: 'ca-pub-0000000000000000',
      slotId: '0000000000',
      scriptUrl: 'mock://google-ads-script',
    };
  }

  /**
   * Check health
   */
  async checkHealth(): Promise<boolean> {
    return true;
  }
}

// Singleton instance
export const mockGoogleAdsManager = new MockGoogleAdsManager();

/**
 * Request a mock ad
 */
export async function requestMockAd(request: AdRequest): Promise<AdResponse> {
  return mockGoogleAdsManager.requestAd(request);
}

/**
 * Get mock AdSense configuration
 */
export function getMockAdSenseConfig() {
  return mockGoogleAdsManager.getAdSenseConfig();
}

/**
 * Check mock Google Ads health
 */
export async function checkMockGoogleAdsHealth(): Promise<boolean> {
  return mockGoogleAdsManager.checkHealth();
}

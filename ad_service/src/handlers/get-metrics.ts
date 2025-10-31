import { getAdMetrics } from '../lib/database.js';
import { logger } from '../lib/logger.js';
import type { AdMetrics } from '../types/index.js';

/**
 * Get ad metrics for analytics
 */
export async function handleGetMetrics(
  adUnitId: string,
  startDate: Date,
  endDate: Date
): Promise<AdMetrics | null> {
  try {
    logger.info('Getting ad metrics', { adUnitId, startDate, endDate });

    const data = await getAdMetrics(adUnitId, startDate, endDate);

    const ctr = data.impressions > 0 ? (data.clicks / data.impressions) * 100 : 0;
    const rpm = data.impressions > 0 ? (data.revenue / data.impressions) * 1000 : 0;

    const metrics: AdMetrics = {
      adUnitId,
      impressions: data.impressions,
      clicks: data.clicks,
      ctr: parseFloat(ctr.toFixed(2)),
      revenue: parseFloat(data.revenue.toFixed(2)),
      rpm: parseFloat(rpm.toFixed(2)),
      period: {
        start: startDate,
        end: endDate,
      },
    };

    logger.info('Ad metrics retrieved', { metrics });

    return metrics;
  } catch (error) {
    logger.error('Failed to get ad metrics', { error, adUnitId });
    return null;
  }
}

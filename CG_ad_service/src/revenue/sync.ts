/**
 * Revenue sync scheduler
 * Fetches revenue data from providers and stores in database
 */

import * as cron from 'node-cron';
import { logger } from '../lib/logger.js';
import { recordDailyRevenue } from '../lib/database.js';
import { getActiveProviders } from '../providers/registry.js';

const SYNC_CRON = process.env.SYNC_REVENUE_CRON || '0 * * * *'; // Hourly by default

let syncTask: cron.ScheduledTask | null = null;

/**
 * Sync revenue for all active providers
 */
export async function syncRevenue(): Promise<void> {
  logger.info('Starting revenue sync');

  const providers = getActiveProviders();
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 1); // Last 24 hours

  for (const provider of providers) {
    if (!provider.fetchRevenue) {
      logger.debug('Provider does not support revenue fetching', { name: provider.name });
      continue;
    }

    try {
      logger.info('Fetching revenue for provider', { name: provider.name, startDate, endDate });
      
      const batches = await provider.fetchRevenue(startDate, endDate);

      for (const batch of batches) {
        await recordDailyRevenue(
          batch.provider,
          batch.date,
          batch.grossRevenue,
          batch.currency,
          batch.sourceRef
        );

        logger.info('Recorded revenue batch', {
          provider: batch.provider,
          date: batch.date,
          revenue: batch.grossRevenue,
          currency: batch.currency,
        });
      }

      logger.info('Completed revenue sync for provider', { name: provider.name });
    } catch (error) {
      logger.error('Failed to sync revenue for provider', {
        error,
        name: provider.name,
      });
    }
  }

  logger.info('Completed revenue sync for all providers');
}

/**
 * Start revenue sync scheduler
 */
export function startRevenueSyncScheduler(): void {
  if (syncTask) {
    logger.warn('Revenue sync scheduler already running');
    return;
  }

  try {
    // Validate cron expression
    if (!cron.validate(SYNC_CRON)) {
      logger.error('Invalid cron expression', { cron: SYNC_CRON });
      return;
    }

    syncTask = cron.schedule(SYNC_CRON, async () => {
      try {
        await syncRevenue();
      } catch (error) {
        logger.error('Revenue sync job failed', { error });
      }
    });

    logger.info('Revenue sync scheduler started', { cron: SYNC_CRON });

    // Run initial sync on startup (after a delay)
    setTimeout(() => {
      syncRevenue().catch((error) => {
        logger.error('Initial revenue sync failed', { error });
      });
    }, 30000); // Wait 30 seconds after startup
  } catch (error) {
    logger.error('Failed to start revenue sync scheduler', { error });
  }
}

/**
 * Stop revenue sync scheduler
 */
export function stopRevenueSyncScheduler(): void {
  if (syncTask) {
    syncTask.stop();
    syncTask = null;
    logger.info('Revenue sync scheduler stopped');
  }
}

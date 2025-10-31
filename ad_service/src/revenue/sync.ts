import cron from 'node-cron';
import { getDatabase } from '../lib/database.js';
import { getProviderByName } from '../providers/registry.js';

export function startRevenueSync(): void {
  const spec = process.env.SYNC_REVENUE_CRON || '0 * * * *';
  cron.schedule(spec, async () => {
    const db = getDatabase();
    const end = new Date();
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    for (const name of (process.env.PROVIDER_LIST || 'google').split(',').map(s => s.trim()).filter(Boolean)) {
      const provider = getProviderByName(name);
      if (!provider || !provider.fetchRevenue) continue;
      try {
        const batches = await provider.fetchRevenue(start, end);
        for (const b of batches) {
          await db.run(
            `INSERT OR REPLACE INTO provider_revenue_daily (id, provider, date, gross_revenue, currency, source_ref, created_at)
             VALUES (
               COALESCE((SELECT id FROM provider_revenue_daily WHERE provider = ? AND date = ?), NULL),
               ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
             )`,
            [b.provider, b.date, b.provider, b.date, b.grossRevenue, b.currency || 'USD', b.sourceRef || null]
          );
        }
      } catch {
        // swallow provider errors; logging can be added here if needed
      }
    }
  });
}




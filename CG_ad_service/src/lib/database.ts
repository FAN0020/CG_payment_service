/**
 * Database operations for Ad Service
 * SQLite database with provider support
 */

import Database from 'better-sqlite3';
import { logger } from './logger.js';
import type { ImpressionRecord, ClickRecord, AdMetrics } from '../types/index.js';

const DB_PATH = process.env.DB_PATH || './data/ad_service.db';

let db: Database.Database | null = null;

/**
 * Initialize database connection and create tables
 */
export function initDatabase(): void {
  try {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL'); // Better concurrency
    db.pragma('foreign_keys = ON');

    // Create tables with provider support
    createTables();

    logger.info('Database initialized', { path: DB_PATH });
  } catch (error) {
    logger.error('Failed to initialize database', { error, path: DB_PATH });
    throw error;
  }
}

/**
 * Create all required tables
 */
function createTables(): void {
  if (!db) {
    throw new Error('Database not initialized');
  }

  // Ad impressions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS ad_impressions (
      id TEXT PRIMARY KEY,
      ad_unit_id TEXT NOT NULL,
      provider TEXT DEFAULT 'google',
      user_id TEXT,
      session_id TEXT NOT NULL,
      page TEXT NOT NULL,
      device_type TEXT DEFAULT 'desktop',
      user_agent TEXT,
      ip_address TEXT,
      fingerprint TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_impressions_provider ON ad_impressions(provider);
    CREATE INDEX IF NOT EXISTS idx_impressions_timestamp ON ad_impressions(timestamp);
    CREATE INDEX IF NOT EXISTS idx_impressions_user ON ad_impressions(user_id);
    CREATE INDEX IF NOT EXISTS idx_impressions_session ON ad_impressions(session_id);
  `);

  // Ad clicks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS ad_clicks (
      id TEXT PRIMARY KEY,
      impression_id TEXT NOT NULL,
      ad_unit_id TEXT NOT NULL,
      provider TEXT DEFAULT 'google',
      user_id TEXT,
      session_id TEXT NOT NULL,
      click_url TEXT,
      revenue REAL DEFAULT 0,
      credits_awarded INTEGER DEFAULT 0,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (impression_id) REFERENCES ad_impressions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_clicks_provider ON ad_clicks(provider);
    CREATE INDEX IF NOT EXISTS idx_clicks_timestamp ON ad_clicks(timestamp);
    CREATE INDEX IF NOT EXISTS idx_clicks_user ON ad_clicks(user_id);
    CREATE INDEX IF NOT EXISTS idx_clicks_impression ON ad_clicks(impression_id);
  `);

  // Provider registry table
  db.exec(`
    CREATE TABLE IF NOT EXISTS ad_providers (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      weight INTEGER DEFAULT 100,
      active BOOLEAN DEFAULT 1,
      config_json TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Daily revenue aggregation table
  db.exec(`
    CREATE TABLE IF NOT EXISTS provider_revenue_daily (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      date DATE NOT NULL,
      gross_revenue REAL NOT NULL DEFAULT 0,
      currency TEXT DEFAULT 'USD',
      source_ref TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (provider, date)
    );

    CREATE INDEX IF NOT EXISTS idx_revenue_provider_date ON provider_revenue_daily(provider, date);
  `);

  // Migrate existing tables (add provider column if missing)
  try {
    // Check if provider column exists in ad_impressions
    const impressionsColumns = db.prepare("PRAGMA table_info(ad_impressions)").all() as Array<{ name: string }>;
    const hasProviderColumn = impressionsColumns.some(col => col.name === 'provider');
    
    if (!hasProviderColumn) {
      db.exec(`
        ALTER TABLE ad_impressions ADD COLUMN provider TEXT DEFAULT 'google';
        ALTER TABLE ad_impressions ADD COLUMN user_agent TEXT;
        ALTER TABLE ad_impressions ADD COLUMN ip_address TEXT;
        ALTER TABLE ad_impressions ADD COLUMN fingerprint TEXT;
      `);
      logger.info('Migrated ad_impressions table');
    }

    // Check if provider column exists in ad_clicks
    const clicksColumns = db.prepare("PRAGMA table_info(ad_clicks)").all() as Array<{ name: string }>;
    const hasClicksProviderColumn = clicksColumns.some(col => col.name === 'provider');
    
    if (!hasClicksProviderColumn) {
      db.exec(`
        ALTER TABLE ad_clicks ADD COLUMN provider TEXT DEFAULT 'google';
        ALTER TABLE ad_clicks ADD COLUMN credits_awarded INTEGER DEFAULT 0;
      `);
      logger.info('Migrated ad_clicks table');
    }
  } catch (error) {
    // Columns might already exist, ignore error
    logger.debug('Table migration skipped (columns may already exist)', { error });
  }

  logger.info('Database tables created/verified');
}

/**
 * Get database instance
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Record an ad impression
 */
export async function recordImpression(record: ImpressionRecord): Promise<void> {
  if (!db) {
    throw new Error('Database not initialized');
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO ad_impressions (
        id, ad_unit_id, provider, user_id, session_id, page, device_type,
        user_agent, ip_address, fingerprint
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      record.id,
      record.adUnitId,
      record.provider,
      record.userId || null,
      record.sessionId,
      record.page,
      record.deviceType,
      record.userAgent || null,
      record.ipAddress || null,
      record.fingerprint || null
    );
  } catch (error) {
    logger.error('Failed to record impression', { error, record });
    throw error;
  }
}

/**
 * Record an ad click
 */
export async function recordClick(record: ClickRecord): Promise<void> {
  if (!db) {
    throw new Error('Database not initialized');
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO ad_clicks (
        id, impression_id, ad_unit_id, provider, user_id, session_id,
        click_url, revenue, credits_awarded
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      record.id,
      record.impressionId,
      record.adUnitId,
      record.provider,
      record.userId || null,
      record.sessionId,
      record.clickUrl || null,
      record.revenue || 0,
      record.creditsAwarded || 0
    );
  } catch (error) {
    logger.error('Failed to record click', { error, record });
    throw error;
  }
}

/**
 * Get ad metrics for a time period
 */
export async function getAdMetrics(
  adUnitId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  impressions: number;
  clicks: number;
  revenue: number;
}> {
  if (!db) {
    throw new Error('Database not initialized');
  }

  try {
    // Get impressions count
    const impressionsStmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM ad_impressions
      WHERE ad_unit_id = ? AND timestamp >= ? AND timestamp <= ?
    `);

    const impressionsResult = impressionsStmt.get(
      adUnitId,
      startDate.toISOString(),
      endDate.toISOString()
    ) as { count: number };

    // Get clicks count and revenue
    const clicksStmt = db.prepare(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(revenue), 0) as revenue
      FROM ad_clicks
      WHERE ad_unit_id = ? AND timestamp >= ? AND timestamp <= ?
    `);

    const clicksResult = clicksStmt.get(
      adUnitId,
      startDate.toISOString(),
      endDate.toISOString()
    ) as { count: number; revenue: number };

    return {
      impressions: impressionsResult.count || 0,
      clicks: clicksResult.count || 0,
      revenue: clicksResult.revenue || 0,
    };
  } catch (error) {
    logger.error('Failed to get ad metrics', { error, adUnitId });
    throw error;
  }
}

/**
 * Get provider-specific metrics
 */
export async function getProviderMetrics(
  provider: string,
  startDate: Date,
  endDate: Date
): Promise<{
  impressions: number;
  clicks: number;
  revenue: number;
  ctr: number;
  rpm: number;
}> {
  if (!db) {
    throw new Error('Database not initialized');
  }

  try {
    const impressionsStmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM ad_impressions
      WHERE provider = ? AND timestamp >= ? AND timestamp <= ?
    `);

    const impressionsResult = impressionsStmt.get(
      provider,
      startDate.toISOString(),
      endDate.toISOString()
    ) as { count: number };

    const clicksStmt = db.prepare(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(revenue), 0) as revenue
      FROM ad_clicks
      WHERE provider = ? AND timestamp >= ? AND timestamp <= ?
    `);

    const clicksResult = clicksStmt.get(
      provider,
      startDate.toISOString(),
      endDate.toISOString()
    ) as { count: number; revenue: number };

    const impressions = impressionsResult.count || 0;
    const clicks = clicksResult.count || 0;
    const revenue = clicksResult.revenue || 0;
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const rpm = impressions > 0 ? (revenue / impressions) * 1000 : 0;

    return {
      impressions,
      clicks,
      revenue,
      ctr: parseFloat(ctr.toFixed(2)),
      rpm: parseFloat(rpm.toFixed(2)),
    };
  } catch (error) {
    logger.error('Failed to get provider metrics', { error, provider });
    throw error;
  }
}

/**
 * Record daily revenue for a provider
 */
export async function recordDailyRevenue(
  provider: string,
  date: Date,
  revenue: number,
  currency: string = 'USD',
  sourceRef?: string
): Promise<void> {
  if (!db) {
    throw new Error('Database not initialized');
  }

  try {
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    
    const stmt = db.prepare(`
      INSERT INTO provider_revenue_daily (provider, date, gross_revenue, currency, source_ref)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(provider, date) DO UPDATE SET
        gross_revenue = excluded.gross_revenue,
        currency = excluded.currency,
        source_ref = excluded.source_ref,
        created_at = CURRENT_TIMESTAMP
    `);

    stmt.run(provider, dateStr, revenue, currency, sourceRef || null);
  } catch (error) {
    logger.error('Failed to record daily revenue', { error, provider, date });
    throw error;
  }
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    logger.info('Database connection closed');
  }
}

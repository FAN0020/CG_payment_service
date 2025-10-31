import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { logger } from './logger.js';
import type { AdUnit, AdImpression, AdClick } from '../types/index.js';

const DB_PATH = process.env.DB_PATH || './data/ad_service.db';

let db: Database | null = null;

/**
 * Initialize database connection and create tables
 */
export async function initDatabase(): Promise<void> {
  try {
    // Ensure database directory exists
    const dbDir = dirname(DB_PATH);
    try {
      mkdirSync(dbDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, ignore
    }

    db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database,
    });

    logger.info('Database connection established', { path: DB_PATH });

    // Create tables
    await createTables();
    // Migrate schema to latest
    await migrateSchema();
    
    logger.info('Database initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize database', { error });
    throw error;
  }
}

/**
 * Create database tables
 */
async function createTables(): Promise<void> {
  if (!db) throw new Error('Database not initialized');

  // Ad Units table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ad_units (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('banner', 'video', 'native', 'interstitial')),
      format TEXT NOT NULL,
      client_id TEXT NOT NULL,
      slot_id TEXT NOT NULL,
      width INTEGER,
      height INTEGER,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused', 'archived')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Ad Impressions table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ad_impressions (
      id TEXT PRIMARY KEY,
      ad_unit_id TEXT NOT NULL,
      provider TEXT DEFAULT 'google',
      user_id TEXT,
      session_id TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      page TEXT NOT NULL,
      device_type TEXT NOT NULL CHECK(device_type IN ('desktop', 'mobile', 'tablet')),
      user_agent TEXT NOT NULL,
      ip_address TEXT,
      country TEXT,
      revenue REAL DEFAULT 0,
      FOREIGN KEY (ad_unit_id) REFERENCES ad_units(id)
    )
  `);

  // Ad Clicks table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ad_clicks (
      id TEXT PRIMARY KEY,
      impression_id TEXT NOT NULL,
      ad_unit_id TEXT NOT NULL,
      provider TEXT DEFAULT 'google',
      user_id TEXT,
      session_id TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      click_url TEXT NOT NULL,
      revenue REAL DEFAULT 0,
      FOREIGN KEY (impression_id) REFERENCES ad_impressions(id),
      FOREIGN KEY (ad_unit_id) REFERENCES ad_units(id)
    )
  `);

  // Create indexes for performance
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_impressions_ad_unit_id ON ad_impressions(ad_unit_id);
    CREATE INDEX IF NOT EXISTS idx_impressions_timestamp ON ad_impressions(timestamp);
    CREATE INDEX IF NOT EXISTS idx_impressions_user_id ON ad_impressions(user_id);
    CREATE INDEX IF NOT EXISTS idx_clicks_impression_id ON ad_clicks(impression_id);
    CREATE INDEX IF NOT EXISTS idx_clicks_ad_unit_id ON ad_clicks(ad_unit_id);
    CREATE INDEX IF NOT EXISTS idx_clicks_timestamp ON ad_clicks(timestamp);
  `);

  logger.info('Database tables created successfully');
}

async function migrateSchema(): Promise<void> {
  if (!db) throw new Error('Database not initialized');
  try {
    const columnsImpr = await db.all<{ name: string }[]>(`PRAGMA table_info(ad_impressions)`);
    const hasProviderImpr = columnsImpr.some(c => c.name === 'provider');
    if (!hasProviderImpr) {
      await db.exec(`ALTER TABLE ad_impressions ADD COLUMN provider TEXT DEFAULT 'google'`);
    }
  } catch (e) {
    logger.warn('Migration: ad_impressions provider column add may have failed', { error: e });
  }

  try {
    const columnsClick = await db.all<{ name: string }[]>(`PRAGMA table_info(ad_clicks)`);
    const hasProviderClick = columnsClick.some(c => c.name === 'provider');
    if (!hasProviderClick) {
      await db.exec(`ALTER TABLE ad_clicks ADD COLUMN provider TEXT DEFAULT 'google'`);
    }
  } catch (e) {
    logger.warn('Migration: ad_clicks provider column add may have failed', { error: e });
  }

  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS ad_providers (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        weight INTEGER DEFAULT 100,
        active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.exec(`
      CREATE TABLE IF NOT EXISTS provider_revenue_daily (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider TEXT NOT NULL,
        date DATE NOT NULL,
        gross_revenue REAL NOT NULL DEFAULT 0,
        currency TEXT DEFAULT 'USD',
        source_ref TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (provider, date)
      )
    `);
  } catch (e) {
    logger.warn('Migration: provider tables creation may have failed', { error: e });
  }
}

/**
 * Get database instance
 */
export function getDatabase(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
    logger.info('Database connection closed');
  }
}

/**
 * Insert ad unit
 */
export async function insertAdUnit(adUnit: Omit<AdUnit, 'createdAt' | 'updatedAt'>): Promise<void> {
  const database = getDatabase();
  
  await database.run(
    `INSERT INTO ad_units (id, name, type, format, client_id, slot_id, width, height, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      adUnit.id,
      adUnit.name,
      adUnit.type,
      adUnit.format,
      adUnit.clientId,
      adUnit.slotId,
      adUnit.size?.width || null,
      adUnit.size?.height || null,
      adUnit.status,
    ]
  );
}

/**
 * Get all active ad units
 */
export async function getActiveAdUnits(): Promise<AdUnit[]> {
  const database = getDatabase();
  
  const rows = await database.all<AdUnit[]>(
    `SELECT * FROM ad_units WHERE status = 'active' ORDER BY created_at DESC`
  );
  
  return rows;
}

/**
 * Record ad impression
 */
export async function recordImpression(impression: Omit<AdImpression, 'timestamp'>): Promise<void> {
  const database = getDatabase();
  
  await database.run(
    `INSERT INTO ad_impressions (id, ad_unit_id, user_id, session_id, page, device_type, user_agent, ip_address, country, revenue)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      impression.id,
      impression.adUnitId,
      impression.userId || null,
      impression.sessionId,
      impression.page,
      impression.deviceType,
      impression.userAgent,
      impression.ipAddress || null,
      impression.country || null,
      impression.revenue || 0,
    ]
  );
}

/**
 * Record ad click
 */
export async function recordClick(click: Omit<AdClick, 'timestamp'>): Promise<void> {
  const database = getDatabase();
  
  await database.run(
    `INSERT INTO ad_clicks (id, impression_id, ad_unit_id, user_id, session_id, click_url, revenue)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      click.id,
      click.impressionId,
      click.adUnitId,
      click.userId || null,
      click.sessionId,
      click.clickUrl,
      click.revenue || 0,
    ]
  );
}

/**
 * Get ad metrics for a specific ad unit and date range
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
  const database = getDatabase();
  
  const impressionData = await database.get<{ count: number; revenue: number }>(
    `SELECT COUNT(*) as count, COALESCE(SUM(revenue), 0) as revenue
     FROM ad_impressions
     WHERE ad_unit_id = ? AND timestamp BETWEEN ? AND ?`,
    [adUnitId, startDate.toISOString(), endDate.toISOString()]
  );
  
  const clickData = await database.get<{ count: number; revenue: number }>(
    `SELECT COUNT(*) as count, COALESCE(SUM(revenue), 0) as revenue
     FROM ad_clicks
     WHERE ad_unit_id = ? AND timestamp BETWEEN ? AND ?`,
    [adUnitId, startDate.toISOString(), endDate.toISOString()]
  );
  
  return {
    impressions: impressionData?.count || 0,
    clicks: clickData?.count || 0,
    revenue: (impressionData?.revenue || 0) + (clickData?.revenue || 0),
  };
}

/**
 * Check database health
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const database = getDatabase();
    await database.get('SELECT 1');
    return true;
  } catch (error) {
    logger.error('Database health check failed', { error });
    return false;
  }
}

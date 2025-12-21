/**
 * SafeOS Database Layer
 *
 * Uses @framers/sql-storage-adapter for cross-platform SQL with
 * automatic adapter selection (better-sqlite3 on Node, IndexedDB in browser).
 *
 * @module db
 */

import { createDatabase, type Database, type StorageHooks } from '@framers/sql-storage-adapter';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// Configuration
// =============================================================================

const BUFFER_MINUTES = parseInt(process.env['SAFEOS_BUFFER_MINUTES'] || '5', 10);
const DB_PATH = process.env['SAFEOS_DB_PATH'] || './data/safeos.db';

// =============================================================================
// Lifecycle Hooks
// =============================================================================

let cleanupScheduled = false;

const hooks: StorageHooks = {
  onAfterWrite: async (context) => {
    // Schedule rolling buffer cleanup after frame_buffer writes
    if (context.statement?.includes('frame_buffer') && !cleanupScheduled) {
      cleanupScheduled = true;
      // Defer cleanup to avoid blocking writes
      setTimeout(async () => {
        try {
          await cleanupOldFrames();
        } finally {
          cleanupScheduled = false;
        }
      }, 1000);
    }
  },
  onAfterQuery: async (context, result) => {
    // Log slow queries for optimization
    if (context.startTime) {
      const duration = Date.now() - context.startTime;
      if (duration > 100) {
        console.warn(`[SafeOS DB] Slow query (${duration}ms):`, context.statement?.slice(0, 100));
      }
    }
    return result;
  },
};

// =============================================================================
// Database Singleton
// =============================================================================

let dbInstance: Database | null = null;
let dbInitializing: Promise<Database> | null = null;

/**
 * Create and initialize the SafeOS database
 */
export async function createSafeOSDatabase(dbPath?: string): Promise<Database> {
  const db = await createDatabase({
    priority: ['better-sqlite3', 'sqljs'],
    filename: dbPath || DB_PATH,
    performance: { tier: 'balanced' },
    hooks,
  });

  await runMigrations(db);
  return db;
}

/**
 * Get the singleton database instance
 */
export async function getSafeOSDatabase(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }

  // Prevent race conditions during initialization
  if (dbInitializing) {
    return dbInitializing;
  }

  dbInitializing = createSafeOSDatabase().then((db) => {
    dbInstance = db;
    dbInitializing = null;
    return db;
  });

  return dbInitializing;
}

/**
 * Close the database connection
 */
export async function closeSafeOSDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}

// =============================================================================
// Migrations
// =============================================================================

async function runMigrations(db: Database): Promise<void> {
  // Create tables if they don't exist
  await db.exec(`
    -- Monitoring streams
    CREATE TABLE IF NOT EXISTS streams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      last_frame_at TEXT,
      metadata TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_streams_status ON streams(status);

    -- Rolling frame buffer (auto-cleaned)
    CREATE TABLE IF NOT EXISTS frame_buffer (
      id TEXT PRIMARY KEY,
      stream_id TEXT NOT NULL,
      frame_data TEXT,
      captured_at TEXT NOT NULL,
      motion_score REAL,
      audio_level REAL,
      analyzed INTEGER DEFAULT 0,
      FOREIGN KEY (stream_id) REFERENCES streams(id)
    );
    CREATE INDEX IF NOT EXISTS idx_frame_captured ON frame_buffer(captured_at);
    CREATE INDEX IF NOT EXISTS idx_frame_stream ON frame_buffer(stream_id);
    CREATE INDEX IF NOT EXISTS idx_frame_analyzed ON frame_buffer(analyzed);

    -- Analysis results
    CREATE TABLE IF NOT EXISTS analysis_results (
      id TEXT PRIMARY KEY,
      stream_id TEXT NOT NULL,
      frame_id TEXT,
      scenario TEXT NOT NULL,
      concern_level TEXT NOT NULL,
      description TEXT,
      model_used TEXT,
      inference_ms INTEGER,
      raw_response TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (stream_id) REFERENCES streams(id)
    );
    CREATE INDEX IF NOT EXISTS idx_analysis_stream ON analysis_results(stream_id);
    CREATE INDEX IF NOT EXISTS idx_analysis_concern ON analysis_results(concern_level);

    -- Alerts
    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      stream_id TEXT NOT NULL,
      analysis_id TEXT,
      alert_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      message TEXT,
      escalation_level INTEGER DEFAULT 0,
      acknowledged INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      acknowledged_at TEXT,
      FOREIGN KEY (stream_id) REFERENCES streams(id),
      FOREIGN KEY (analysis_id) REFERENCES analysis_results(id)
    );
    CREATE INDEX IF NOT EXISTS idx_alerts_stream ON alerts(stream_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
    CREATE INDEX IF NOT EXISTS idx_alerts_ack ON alerts(acknowledged);

    -- Monitoring profiles
    CREATE TABLE IF NOT EXISTS monitoring_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      scenario TEXT NOT NULL,
      motion_threshold REAL NOT NULL,
      audio_threshold REAL NOT NULL,
      alert_speed TEXT NOT NULL,
      description TEXT,
      custom_prompt TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    );

    -- Content moderation flags
    CREATE TABLE IF NOT EXISTS content_flags (
      id TEXT PRIMARY KEY,
      stream_id TEXT NOT NULL,
      frame_id TEXT,
      tier INTEGER NOT NULL,
      categories TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewed_by TEXT,
      reviewed_at TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (stream_id) REFERENCES streams(id)
    );
    CREATE INDEX IF NOT EXISTS idx_flags_status ON content_flags(status);
    CREATE INDEX IF NOT EXISTS idx_flags_tier ON content_flags(tier);

    -- Analysis job queue
    CREATE TABLE IF NOT EXISTS analysis_queue (
      id TEXT PRIMARY KEY,
      stream_id TEXT NOT NULL,
      frame_data TEXT NOT NULL,
      scenario TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'normal',
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER DEFAULT 0,
      max_attempts INTEGER DEFAULT 3,
      error TEXT,
      created_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT,
      FOREIGN KEY (stream_id) REFERENCES streams(id)
    );
    CREATE INDEX IF NOT EXISTS idx_queue_status ON analysis_queue(status);
    CREATE INDEX IF NOT EXISTS idx_queue_priority ON analysis_queue(priority, created_at);
  `);

  // Insert default profiles if none exist
  const profileCount = await db.get<{ count: number }>(
    'SELECT COUNT(*) as count FROM monitoring_profiles'
  );

  if (profileCount && profileCount.count === 0) {
    await insertDefaultProfiles(db);
  }

  console.log('[SafeOS DB] Migrations complete');
}

async function insertDefaultProfiles(db: Database): Promise<void> {
  const now = new Date().toISOString();
  const profiles = [
    {
      id: uuidv4(),
      name: 'Pet Monitoring',
      scenario: 'pet',
      motion_threshold: 0.2,
      audio_threshold: 0.3,
      alert_speed: 'normal',
      description: 'Monitor pets for activity, eating, drinking, and distress',
    },
    {
      id: uuidv4(),
      name: 'Baby Monitor',
      scenario: 'baby',
      motion_threshold: 0.1,
      audio_threshold: 0.15,
      alert_speed: 'fast',
      description: 'Watch babies and toddlers for safety and crying',
    },
    {
      id: uuidv4(),
      name: 'Elderly Care',
      scenario: 'elderly',
      motion_threshold: 0.15,
      audio_threshold: 0.2,
      alert_speed: 'immediate',
      description: 'Monitor elderly for falls, distress, and inactivity',
    },
  ];

  for (const profile of profiles) {
    await db.run(
      `INSERT INTO monitoring_profiles 
       (id, name, scenario, motion_threshold, audio_threshold, alert_speed, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        profile.id,
        profile.name,
        profile.scenario,
        profile.motion_threshold,
        profile.audio_threshold,
        profile.alert_speed,
        profile.description,
        now,
      ]
    );
  }

  console.log('[SafeOS DB] Inserted default monitoring profiles');
}

// =============================================================================
// Rolling Buffer Cleanup
// =============================================================================

/**
 * Delete frames older than the buffer window
 */
async function cleanupOldFrames(): Promise<number> {
  const db = await getSafeOSDatabase();
  const cutoff = new Date(Date.now() - BUFFER_MINUTES * 60 * 1000).toISOString();
  
  const result = await db.run(
    'DELETE FROM frame_buffer WHERE captured_at < ?',
    [cutoff]
  );

  if (result.changes && result.changes > 0) {
    console.log(`[SafeOS DB] Cleaned up ${result.changes} old frames`);
  }

  return result.changes || 0;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generate a new UUID
 */
export function generateId(): string {
  return uuidv4();
}

/**
 * Get current ISO timestamp
 */
export function now(): string {
  return new Date().toISOString();
}


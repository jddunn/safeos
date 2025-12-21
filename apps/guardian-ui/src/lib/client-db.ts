/**
 * Client-Side Database
 *
 * Uses idb (IndexedDB wrapper) for browser-native offline-first data persistence.
 * This is a pure browser implementation with no Node.js dependencies.
 *
 * @module lib/client-db
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

// =============================================================================
// Database Schema
// =============================================================================

interface SafeOSDB extends DBSchema {
  local_session: {
    key: string;
    value: {
      id: string;
      token: string;
      deviceId: string | null;
      profile: any;
      createdAt: string;
      expiresAt: string;
      syncedAt: string | null;
    };
  };
  profile_cache: {
    key: string;
    value: {
      id: string;
      displayName: string;
      avatarUrl: string | null;
      preferences: any;
      notificationSettings: any;
      updatedAt: string;
    };
  };
  stream_cache: {
    key: string;
    value: {
      id: string;
      name: string;
      scenario: string;
      status: string;
      preferences: any;
      createdAt: string;
      updatedAt: string;
      syncedAt: string;
    };
    indexes: { 'by-created': string };
  };
  alert_cache: {
    key: string;
    value: {
      id: string;
      streamId: string;
      severity: string;
      message: string;
      description: string;
      acknowledged: boolean;
      acknowledgedAt: string | null;
      createdAt: string;
      syncedAt: string;
    };
    indexes: { 'by-stream': string; 'by-created': string };
  };
  frame_cache: {
    key: string;
    value: {
      id: string;
      streamId: string;
      frameData: string;
      motionScore: number;
      audioLevel: number;
      analyzed: boolean;
      createdAt: string;
    };
    indexes: { 'by-stream': string; 'by-created': string };
  };
  sync_queue: {
    key: string;
    value: {
      id: string;
      action: string;
      endpoint: string;
      method: string;
      body: any;
      createdAt: string;
      retries: number;
      lastError: string | null;
    };
    indexes: { 'by-created': string };
  };
  settings_cache: {
    key: string;
    value: {
      key: string;
      value: any;
      updatedAt: string;
    };
  };
  consent_log: {
    key: string;
    value: {
      id: string;
      consentType: string;
      accepted: boolean;
      version: string;
      userAgent: string | null;
      createdAt: string;
    };
    indexes: { 'by-type': string };
  };
}

// =============================================================================
// Configuration
// =============================================================================

const DB_NAME = 'safeos-guardian';
const DB_VERSION = 1;

const FRAME_BUFFER_MINUTES = 5;
const MAX_CACHED_ALERTS = 500;

// =============================================================================
// Database Instance
// =============================================================================

let dbPromise: Promise<IDBPDatabase<SafeOSDB>> | null = null;

function getDB(): Promise<IDBPDatabase<SafeOSDB>> {
  if (typeof window === 'undefined') {
    // SSR - return a mock that does nothing
    return Promise.reject(new Error('IndexedDB not available on server'));
  }

  if (!dbPromise) {
    dbPromise = openDB<SafeOSDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Create stores
        if (!db.objectStoreNames.contains('local_session')) {
          db.createObjectStore('local_session', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('profile_cache')) {
          db.createObjectStore('profile_cache', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('stream_cache')) {
          const streamStore = db.createObjectStore('stream_cache', { keyPath: 'id' });
          streamStore.createIndex('by-created', 'createdAt');
        }

        if (!db.objectStoreNames.contains('alert_cache')) {
          const alertStore = db.createObjectStore('alert_cache', { keyPath: 'id' });
          alertStore.createIndex('by-stream', 'streamId');
          alertStore.createIndex('by-created', 'createdAt');
        }

        if (!db.objectStoreNames.contains('frame_cache')) {
          const frameStore = db.createObjectStore('frame_cache', { keyPath: 'id' });
          frameStore.createIndex('by-stream', 'streamId');
          frameStore.createIndex('by-created', 'createdAt');
        }

        if (!db.objectStoreNames.contains('sync_queue')) {
          const syncStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
          syncStore.createIndex('by-created', 'createdAt');
        }

        if (!db.objectStoreNames.contains('settings_cache')) {
          db.createObjectStore('settings_cache', { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains('consent_log')) {
          const consentStore = db.createObjectStore('consent_log', { keyPath: 'id' });
          consentStore.createIndex('by-type', 'consentType');
        }
      },
    });
  }

  return dbPromise;
}

// =============================================================================
// Cleanup Functions
// =============================================================================

async function cleanupOldFrames(): Promise<void> {
  try {
    const db = await getDB();
    const cutoff = new Date(Date.now() - FRAME_BUFFER_MINUTES * 60 * 1000).toISOString();

    const tx = db.transaction('frame_cache', 'readwrite');
    const index = tx.store.index('by-created');

    let cursor = await index.openCursor(IDBKeyRange.upperBound(cutoff));
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }

    await tx.done;
  } catch {
    // Ignore cleanup errors
  }
}

export async function cleanupCaches(): Promise<void> {
  await cleanupOldFrames();

  try {
    const db = await getDB();

    // Limit alerts
    const alerts = await db.getAllFromIndex('alert_cache', 'by-created');
    if (alerts.length > MAX_CACHED_ALERTS) {
      const tx = db.transaction('alert_cache', 'readwrite');
      const toDelete = alerts.slice(0, alerts.length - MAX_CACHED_ALERTS);
      for (const alert of toDelete) {
        await tx.store.delete(alert.id);
      }
      await tx.done;
    }
  } catch {
    // Ignore cleanup errors
  }
}

// =============================================================================
// Session Management
// =============================================================================

export interface LocalSession {
  id: string;
  token: string;
  deviceId: string | null;
  profile: any;
  createdAt: string;
  expiresAt: string;
  syncedAt: string | null;
}

export async function saveLocalSession(session: LocalSession): Promise<void> {
  try {
    const db = await getDB();
    await db.put('local_session', session);
  } catch (error) {
    console.warn('[ClientDB] Failed to save session:', error);
  }
}

export async function getLocalSession(): Promise<LocalSession | null> {
  try {
    const db = await getDB();
    const sessions = await db.getAll('local_session');

    const now = new Date().toISOString();
    const validSession = sessions.find(s => s.expiresAt > now);

    return validSession || null;
  } catch (error) {
    console.warn('[ClientDB] Failed to get session:', error);
    return null;
  }
}

export async function clearLocalSession(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear('local_session');
  } catch {
    // Ignore
  }
}

// =============================================================================
// Profile Cache
// =============================================================================

export async function cacheProfile(profile: any): Promise<void> {
  try {
    const db = await getDB();
    await db.put('profile_cache', {
      id: profile.id,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      preferences: profile.preferences || {},
      notificationSettings: profile.notificationSettings || {},
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('[ClientDB] Failed to cache profile:', error);
  }
}

export async function getCachedProfile(id: string): Promise<any | null> {
  try {
    const db = await getDB();
    const profile = await db.get('profile_cache', id);
    return profile || null;
  } catch {
    return null;
  }
}

// =============================================================================
// Stream Cache
// =============================================================================

export async function cacheStream(stream: any): Promise<void> {
  try {
    const db = await getDB();
    await db.put('stream_cache', {
      id: stream.id,
      name: stream.name,
      scenario: stream.scenario,
      status: stream.status,
      preferences: stream.preferences || {},
      createdAt: stream.createdAt,
      updatedAt: stream.updatedAt || new Date().toISOString(),
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('[ClientDB] Failed to cache stream:', error);
  }
}

export async function getCachedStreams(): Promise<any[]> {
  try {
    const db = await getDB();
    return await db.getAll('stream_cache');
  } catch {
    return [];
  }
}

// =============================================================================
// Alert Cache
// =============================================================================

export async function cacheAlert(alert: any): Promise<void> {
  try {
    const db = await getDB();
    await db.put('alert_cache', {
      id: alert.id,
      streamId: alert.streamId,
      severity: alert.severity,
      message: alert.message,
      description: alert.description,
      acknowledged: alert.acknowledged || false,
      acknowledgedAt: alert.acknowledgedAt,
      createdAt: alert.createdAt,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('[ClientDB] Failed to cache alert:', error);
  }
}

export async function getCachedAlerts(streamId?: string): Promise<any[]> {
  try {
    const db = await getDB();

    if (streamId) {
      return await db.getAllFromIndex('alert_cache', 'by-stream', streamId);
    }

    const alerts = await db.getAll('alert_cache');
    return alerts.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100);
  } catch {
    return [];
  }
}

// =============================================================================
// Offline Sync Queue
// =============================================================================

export interface SyncAction {
  id: string;
  action: string;
  endpoint: string;
  method: string;
  body: any;
  createdAt: string;
  retries: number;
  lastError: string | null;
}

export async function queueSyncAction(
  action: Omit<SyncAction, 'id' | 'createdAt' | 'retries' | 'lastError'>
): Promise<void> {
  try {
    const db = await getDB();
    const id = `sync-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    await db.put('sync_queue', {
      id,
      action: action.action,
      endpoint: action.endpoint,
      method: action.method,
      body: action.body,
      createdAt: new Date().toISOString(),
      retries: 0,
      lastError: null,
    });
  } catch (error) {
    console.warn('[ClientDB] Failed to queue sync action:', error);
  }
}

export async function getPendingSyncActions(): Promise<SyncAction[]> {
  try {
    const db = await getDB();
    return await db.getAllFromIndex('sync_queue', 'by-created');
  } catch {
    return [];
  }
}

export async function removeSyncAction(id: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('sync_queue', id);
  } catch {
    // Ignore
  }
}

export async function markSyncActionFailed(id: string, error: string): Promise<void> {
  try {
    const db = await getDB();
    const action = await db.get('sync_queue', id);
    if (action) {
      action.retries++;
      action.lastError = error;
      await db.put('sync_queue', action);
    }
  } catch {
    // Ignore
  }
}

// =============================================================================
// Settings
// =============================================================================

export async function saveSetting(key: string, value: any): Promise<void> {
  try {
    const db = await getDB();
    await db.put('settings_cache', {
      key,
      value,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('[ClientDB] Failed to save setting:', error);
  }
}

export async function getSetting<T>(key: string): Promise<T | null> {
  try {
    const db = await getDB();
    const setting = await db.get('settings_cache', key);
    return setting?.value as T || null;
  } catch {
    return null;
  }
}

// =============================================================================
// Consent Tracking
// =============================================================================

export async function logConsent(type: string, accepted: boolean, version: string): Promise<void> {
  try {
    const db = await getDB();
    const id = `consent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    await db.put('consent_log', {
      id,
      consentType: type,
      accepted,
      version,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('[ClientDB] Failed to log consent:', error);
  }
}

export async function hasAcceptedConsent(type: string): Promise<boolean> {
  try {
    const db = await getDB();
    const consents = await db.getAllFromIndex('consent_log', 'by-type', type);

    if (consents.length === 0) return false;

    // Get the most recent consent
    const sorted = consents.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return sorted[0]?.accepted || false;
  } catch {
    return false;
  }
}

// =============================================================================
// Storage Stats
// =============================================================================

export async function getStorageStats(): Promise<{
  frames: number;
  alerts: number;
  syncPending: number;
}> {
  try {
    const db = await getDB();

    const [frames, alerts, sync] = await Promise.all([
      db.count('frame_cache'),
      db.count('alert_cache'),
      db.count('sync_queue'),
    ]);

    return { frames, alerts, syncPending: sync };
  } catch {
    return { frames: 0, alerts: 0, syncPending: 0 };
  }
}

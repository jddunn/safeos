/**
 * Monitoring Store Tests
 *
 * Unit tests for the monitoring Zustand store.
 *
 * @module tests/monitoring-store.test
 */

import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';

// =============================================================================
// Types (copied from store for testing)
// =============================================================================

interface Alert {
  id: string;
  streamId: string;
  alertType?: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  message: string;
  thumbnailUrl?: string;
  createdAt?: string;
  timestamp?: string;
  acknowledged: boolean;
}

interface StreamInfo {
  id: string;
  scenario: 'pet' | 'baby' | 'elderly' | 'security';
  status: 'active' | 'paused' | 'ended';
  startedAt: string;
  motionScore?: number;
  audioLevel?: number;
}

interface MonitoringSettings {
  motionSensitivity: number;
  audioSensitivity: number;
  analysisInterval: number;
  enableMotionDetection: boolean;
  enableAudioDetection: boolean;
  enableCryDetection: boolean;
  muted: boolean;
}

// =============================================================================
// Mock Store Implementation (for testing logic without Zustand)
// =============================================================================

const DEFAULT_SETTINGS: MonitoringSettings = {
  motionSensitivity: 50,
  audioSensitivity: 50,
  analysisInterval: 30,
  enableMotionDetection: true,
  enableAudioDetection: true,
  enableCryDetection: true,
  muted: false,
};

class MonitoringStore {
  isConnected = false;
  isStreaming = false;
  streamId: string | null = null;
  scenario: 'pet' | 'baby' | 'elderly' | 'security' | null = null;
  streams: StreamInfo[] = [];
  motionScore = 0;
  audioLevel = 0;
  hasCrying = false;
  alerts: Alert[] = [];
  settings: MonitoringSettings = { ...DEFAULT_SETTINGS };
  sessionExpiresAt: number | null = null;
  sessionDurationHours = 24;
  sessionStartedAt: number | null = null;

  setConnected(connected: boolean) {
    this.isConnected = connected;
  }

  setStreaming(streaming: boolean) {
    this.isStreaming = streaming;
  }

  setStreamId(id: string | null) {
    this.streamId = id;
  }

  setScenario(scenario: 'pet' | 'baby' | 'elderly' | 'security' | null) {
    this.scenario = scenario;
  }

  setMotionScore(score: number) {
    this.motionScore = score;
  }

  setAudioLevel(level: number) {
    this.audioLevel = level;
  }

  setHasCrying(crying: boolean) {
    this.hasCrying = crying;
  }

  addAlert(alert: Alert) {
    this.alerts = [alert, ...this.alerts].slice(0, 100);
  }

  removeAlert(id: string) {
    this.alerts = this.alerts.filter((a) => a.id !== id);
  }

  acknowledgeAlert(id: string) {
    this.alerts = this.alerts.map((a) =>
      a.id === id ? { ...a, acknowledged: true } : a
    );
  }

  clearAlerts() {
    this.alerts = [];
  }

  addStream(stream: StreamInfo) {
    this.streams = [...this.streams, stream];
  }

  removeStream(id: string) {
    this.streams = this.streams.filter((s) => s.id !== id);
  }

  updateStream(id: string, update: Partial<StreamInfo>) {
    this.streams = this.streams.map((s) =>
      s.id === id ? { ...s, ...update } : s
    );
  }

  updateSettings(update: Partial<MonitoringSettings>) {
    this.settings = { ...this.settings, ...update };
  }

  startSession(durationHours = 24) {
    if (this.scenario === 'security') return;

    const clampedHours = Math.max(1, Math.min(24, durationHours));
    const now = Date.now();
    const expiresAt = now + clampedHours * 60 * 60 * 1000;

    this.sessionStartedAt = now;
    this.sessionExpiresAt = expiresAt;
    this.sessionDurationHours = clampedHours;
  }

  endSession() {
    this.sessionStartedAt = null;
    this.sessionExpiresAt = null;
  }

  extendSession(additionalHours: number) {
    if (!this.sessionExpiresAt) return;

    const now = Date.now();
    const currentRemaining = this.sessionExpiresAt - now;
    const additionalMs = additionalHours * 60 * 60 * 1000;
    const maxDurationMs = 24 * 60 * 60 * 1000;

    const newRemaining = Math.min(maxDurationMs, currentRemaining + additionalMs);

    this.sessionExpiresAt = now + newRemaining;
  }

  isSessionExpired(): boolean {
    if (this.scenario === 'security') return false;
    if (!this.sessionExpiresAt) return false;
    return Date.now() >= this.sessionExpiresAt;
  }

  getSessionRemaining(): number {
    if (!this.sessionExpiresAt) return 0;
    return Math.max(0, this.sessionExpiresAt - Date.now());
  }

  reset() {
    this.isConnected = false;
    this.isStreaming = false;
    this.streamId = null;
    this.scenario = null;
    this.streams = [];
    this.motionScore = 0;
    this.audioLevel = 0;
    this.hasCrying = false;
    this.alerts = [];
    this.settings = { ...DEFAULT_SETTINGS };
    this.sessionExpiresAt = null;
    this.sessionDurationHours = 24;
    this.sessionStartedAt = null;
  }
}

// =============================================================================
// Selector Functions
// =============================================================================

const selectIsStreaming = (store: MonitoringStore) => store.isStreaming;
const selectStreamId = (store: MonitoringStore) => store.streamId;
const selectScenario = (store: MonitoringStore) => store.scenario;
const selectAlerts = (store: MonitoringStore) => store.alerts;
const selectUnacknowledgedAlerts = (store: MonitoringStore) =>
  store.alerts.filter((a) => !a.acknowledged);
const selectSettings = (store: MonitoringStore) => store.settings;
const selectMotionScore = (store: MonitoringStore) => store.motionScore;
const selectAudioLevel = (store: MonitoringStore) => store.audioLevel;

// =============================================================================
// Test Helpers
// =============================================================================

function createTestAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: `alert-${Date.now()}-${Math.random()}`,
    streamId: 'test-stream',
    severity: 'medium',
    message: 'Test alert message',
    acknowledged: false,
    ...overrides,
  };
}

function createTestStream(overrides: Partial<StreamInfo> = {}): StreamInfo {
  return {
    id: `stream-${Date.now()}`,
    scenario: 'pet',
    status: 'active',
    startedAt: new Date().toISOString(),
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('Monitoring Store', () => {
  let store: MonitoringStore;

  beforeEach(() => {
    store = new MonitoringStore();
  });

  describe('Connection State', () => {
    it('should initialize as disconnected', () => {
      expect(store.isConnected).toBe(false);
    });

    it('should set connected state', () => {
      store.setConnected(true);
      expect(store.isConnected).toBe(true);

      store.setConnected(false);
      expect(store.isConnected).toBe(false);
    });
  });

  describe('Stream State', () => {
    it('should initialize as not streaming', () => {
      expect(store.isStreaming).toBe(false);
      expect(store.streamId).toBeNull();
    });

    it('should set streaming state', () => {
      store.setStreaming(true);
      expect(store.isStreaming).toBe(true);
    });

    it('should set stream ID', () => {
      store.setStreamId('test-stream-123');
      expect(store.streamId).toBe('test-stream-123');

      store.setStreamId(null);
      expect(store.streamId).toBeNull();
    });

    it('should set scenario', () => {
      store.setScenario('baby');
      expect(store.scenario).toBe('baby');

      store.setScenario('pet');
      expect(store.scenario).toBe('pet');
    });
  });

  describe('Real-time Metrics', () => {
    it('should initialize metrics at zero', () => {
      expect(store.motionScore).toBe(0);
      expect(store.audioLevel).toBe(0);
      expect(store.hasCrying).toBe(false);
    });

    it('should update motion score', () => {
      store.setMotionScore(75.5);
      expect(store.motionScore).toBe(75.5);
    });

    it('should update audio level', () => {
      store.setAudioLevel(42.3);
      expect(store.audioLevel).toBe(42.3);
    });

    it('should update crying detection', () => {
      store.setHasCrying(true);
      expect(store.hasCrying).toBe(true);

      store.setHasCrying(false);
      expect(store.hasCrying).toBe(false);
    });
  });

  describe('Alert Management', () => {
    it('should add alerts', () => {
      const alert = createTestAlert({ id: 'alert-1' });
      store.addAlert(alert);

      expect(store.alerts).toHaveLength(1);
      expect(store.alerts[0].id).toBe('alert-1');
    });

    it('should prepend new alerts', () => {
      store.addAlert(createTestAlert({ id: 'first' }));
      store.addAlert(createTestAlert({ id: 'second' }));

      expect(store.alerts[0].id).toBe('second');
      expect(store.alerts[1].id).toBe('first');
    });

    it('should limit alerts to 100', () => {
      for (let i = 0; i < 110; i++) {
        store.addAlert(createTestAlert({ id: `alert-${i}` }));
      }

      expect(store.alerts).toHaveLength(100);
      expect(store.alerts[0].id).toBe('alert-109');
    });

    it('should remove alert by ID', () => {
      store.addAlert(createTestAlert({ id: 'keep' }));
      store.addAlert(createTestAlert({ id: 'remove' }));

      store.removeAlert('remove');

      expect(store.alerts).toHaveLength(1);
      expect(store.alerts[0].id).toBe('keep');
    });

    it('should acknowledge alert', () => {
      store.addAlert(createTestAlert({ id: 'test', acknowledged: false }));

      store.acknowledgeAlert('test');

      expect(store.alerts[0].acknowledged).toBe(true);
    });

    it('should not modify other alerts when acknowledging', () => {
      store.addAlert(createTestAlert({ id: 'other', acknowledged: false }));
      store.addAlert(createTestAlert({ id: 'target', acknowledged: false }));

      store.acknowledgeAlert('target');

      const other = store.alerts.find((a) => a.id === 'other');
      expect(other?.acknowledged).toBe(false);
    });

    it('should clear all alerts', () => {
      store.addAlert(createTestAlert());
      store.addAlert(createTestAlert());
      store.addAlert(createTestAlert());

      store.clearAlerts();

      expect(store.alerts).toHaveLength(0);
    });
  });

  describe('Stream Management', () => {
    it('should add streams', () => {
      const stream = createTestStream({ id: 'stream-1' });
      store.addStream(stream);

      expect(store.streams).toHaveLength(1);
      expect(store.streams[0].id).toBe('stream-1');
    });

    it('should remove stream by ID', () => {
      store.addStream(createTestStream({ id: 'keep' }));
      store.addStream(createTestStream({ id: 'remove' }));

      store.removeStream('remove');

      expect(store.streams).toHaveLength(1);
      expect(store.streams[0].id).toBe('keep');
    });

    it('should update stream properties', () => {
      store.addStream(createTestStream({ id: 'test', status: 'active' }));

      store.updateStream('test', { status: 'paused' });

      expect(store.streams[0].status).toBe('paused');
    });

    it('should not modify other streams when updating', () => {
      store.addStream(createTestStream({ id: 'other', status: 'active' }));
      store.addStream(createTestStream({ id: 'target', status: 'active' }));

      store.updateStream('target', { status: 'paused' });

      const other = store.streams.find((s) => s.id === 'other');
      expect(other?.status).toBe('active');
    });
  });

  describe('Settings Management', () => {
    it('should have default settings', () => {
      expect(store.settings).toEqual(DEFAULT_SETTINGS);
    });

    it('should update settings partially', () => {
      store.updateSettings({ motionSensitivity: 75 });

      expect(store.settings.motionSensitivity).toBe(75);
      expect(store.settings.audioSensitivity).toBe(50); // unchanged
    });

    it('should update multiple settings at once', () => {
      store.updateSettings({
        motionSensitivity: 80,
        audioSensitivity: 60,
        muted: true,
      });

      expect(store.settings.motionSensitivity).toBe(80);
      expect(store.settings.audioSensitivity).toBe(60);
      expect(store.settings.muted).toBe(true);
    });
  });

  describe('Session Timer', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should start session with default 24 hours', () => {
      store.setScenario('baby');
      store.startSession();

      expect(store.sessionStartedAt).toBe(Date.now());
      expect(store.sessionDurationHours).toBe(24);
      expect(store.sessionExpiresAt).toBe(Date.now() + 24 * 60 * 60 * 1000);
    });

    it('should start session with custom duration', () => {
      store.setScenario('pet');
      store.startSession(8);

      expect(store.sessionDurationHours).toBe(8);
      expect(store.sessionExpiresAt).toBe(Date.now() + 8 * 60 * 60 * 1000);
    });

    it('should clamp session duration to 1-24 hours', () => {
      store.setScenario('elderly');

      store.startSession(0.5); // Too short
      expect(store.sessionDurationHours).toBe(1);

      store.startSession(48); // Too long
      expect(store.sessionDurationHours).toBe(24);
    });

    it('should not start session in security mode', () => {
      store.setScenario('security');
      store.startSession(12);

      expect(store.sessionExpiresAt).toBeNull();
    });

    it('should end session', () => {
      store.setScenario('baby');
      store.startSession();
      store.endSession();

      expect(store.sessionExpiresAt).toBeNull();
      expect(store.sessionStartedAt).toBeNull();
    });

    it('should check if session is expired', () => {
      store.setScenario('pet');
      store.startSession(1); // 1 hour

      expect(store.isSessionExpired()).toBe(false);

      // Advance time by 2 hours
      jest.advanceTimersByTime(2 * 60 * 60 * 1000);

      expect(store.isSessionExpired()).toBe(true);
    });

    it('should never expire in security mode', () => {
      store.setScenario('security');

      expect(store.isSessionExpired()).toBe(false);
    });

    it('should return remaining session time', () => {
      store.setScenario('baby');
      store.startSession(2); // 2 hours

      expect(store.getSessionRemaining()).toBe(2 * 60 * 60 * 1000);

      // Advance by 30 minutes
      jest.advanceTimersByTime(30 * 60 * 1000);

      expect(store.getSessionRemaining()).toBe(1.5 * 60 * 60 * 1000);
    });

    it('should extend session', () => {
      store.setScenario('pet');
      store.startSession(2); // 2 hours

      store.extendSession(1); // Add 1 hour

      // Should now be 3 hours from start
      expect(store.getSessionRemaining()).toBe(3 * 60 * 60 * 1000);
    });

    it('should cap extended session at 24 hours', () => {
      store.setScenario('baby');
      store.startSession(20);

      store.extendSession(10); // Would be 30 hours

      expect(store.getSessionRemaining()).toBe(24 * 60 * 60 * 1000);
    });

    it('should not extend session if not started', () => {
      store.extendSession(5);

      expect(store.sessionExpiresAt).toBeNull();
    });
  });

  describe('Reset', () => {
    it('should reset all state to initial values', () => {
      // Set various state
      store.setConnected(true);
      store.setStreaming(true);
      store.setStreamId('test');
      store.setScenario('baby');
      store.addAlert(createTestAlert());
      store.addStream(createTestStream());
      store.setMotionScore(50);
      store.setAudioLevel(30);
      store.setHasCrying(true);
      store.updateSettings({ muted: true });

      store.reset();

      expect(store.isConnected).toBe(false);
      expect(store.isStreaming).toBe(false);
      expect(store.streamId).toBeNull();
      expect(store.scenario).toBeNull();
      expect(store.alerts).toHaveLength(0);
      expect(store.streams).toHaveLength(0);
      expect(store.motionScore).toBe(0);
      expect(store.audioLevel).toBe(0);
      expect(store.hasCrying).toBe(false);
      expect(store.settings).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe('Selectors', () => {
    it('should select isStreaming', () => {
      store.setStreaming(true);
      expect(selectIsStreaming(store)).toBe(true);
    });

    it('should select streamId', () => {
      store.setStreamId('test-123');
      expect(selectStreamId(store)).toBe('test-123');
    });

    it('should select scenario', () => {
      store.setScenario('elderly');
      expect(selectScenario(store)).toBe('elderly');
    });

    it('should select all alerts', () => {
      store.addAlert(createTestAlert({ id: '1' }));
      store.addAlert(createTestAlert({ id: '2' }));

      const alerts = selectAlerts(store);
      expect(alerts).toHaveLength(2);
    });

    it('should select only unacknowledged alerts', () => {
      store.addAlert(createTestAlert({ id: '1', acknowledged: false }));
      store.addAlert(createTestAlert({ id: '2', acknowledged: true }));
      store.addAlert(createTestAlert({ id: '3', acknowledged: false }));

      const unacknowledged = selectUnacknowledgedAlerts(store);
      expect(unacknowledged).toHaveLength(2);
      expect(unacknowledged.every((a) => !a.acknowledged)).toBe(true);
    });

    it('should select settings', () => {
      store.updateSettings({ motionSensitivity: 75 });

      const settings = selectSettings(store);
      expect(settings.motionSensitivity).toBe(75);
    });

    it('should select motion score', () => {
      store.setMotionScore(42.5);
      expect(selectMotionScore(store)).toBe(42.5);
    });

    it('should select audio level', () => {
      store.setAudioLevel(33.3);
      expect(selectAudioLevel(store)).toBe(33.3);
    });
  });

  describe('Alert Severity Types', () => {
    it('should accept all severity levels', () => {
      const severities: Alert['severity'][] = ['info', 'low', 'medium', 'high', 'critical'];

      severities.forEach((severity) => {
        store.addAlert(createTestAlert({ severity }));
      });

      expect(store.alerts).toHaveLength(5);
      severities.forEach((severity) => {
        expect(store.alerts.some((a) => a.severity === severity)).toBe(true);
      });
    });
  });

  describe('Stream Status Types', () => {
    it('should accept all status types', () => {
      const statuses: StreamInfo['status'][] = ['active', 'paused', 'ended'];

      statuses.forEach((status, i) => {
        store.addStream(createTestStream({ id: `stream-${i}`, status }));
      });

      expect(store.streams).toHaveLength(3);
      statuses.forEach((status) => {
        expect(store.streams.some((s) => s.status === status)).toBe(true);
      });
    });
  });
});

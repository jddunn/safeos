/**
 * Monitoring Store
 *
 * Zustand store for real-time monitoring state.
 *
 * @module stores/monitoring-store
 */

import { create } from 'zustand';

// =============================================================================
// Types
// =============================================================================

export type AlertSeverity = 'info' | 'warning' | 'urgent' | 'critical';

export interface Alert {
  id: string;
  streamId: string;
  type: string;
  severity: AlertSeverity;
  message: string;
  timestamp: string;
  acknowledged: boolean;
  escalationLevel: number;
}

export interface StreamInfo {
  id: string;
  scenario: 'pet' | 'baby' | 'elderly';
  status: 'connecting' | 'active' | 'paused' | 'disconnected';
  startedAt: string;
  motionScore: number;
  audioLevel: number;
  lastAnalysisAt: string | null;
}

interface MonitoringState {
  // Stream state
  isStreaming: boolean;
  streamId: string | null;
  streamInfo: StreamInfo | null;

  // Detection metrics
  motionScore: number;
  audioLevel: number;
  lastFrameTime: number;

  // Alerts
  alerts: Alert[];
  activeAlerts: number;
  unacknowledgedAlerts: number;

  // Sound settings
  soundEnabled: boolean;
  volume: number;
  notificationsEnabled: boolean;

  // Connection state
  wsConnected: boolean;
  lastPing: number;

  // Camera state
  cameraPermission: 'pending' | 'granted' | 'denied';
  micPermission: 'pending' | 'granted' | 'denied';

  // Actions - Stream
  startStream: (streamId: string, scenario: 'pet' | 'baby' | 'elderly') => void;
  stopStream: () => void;
  updateStreamStatus: (status: StreamInfo['status']) => void;

  // Actions - Metrics
  updateMotionScore: (score: number) => void;
  updateAudioLevel: (level: number) => void;
  recordFrame: () => void;

  // Actions - Alerts
  addAlert: (alert: Omit<Alert, 'id' | 'timestamp' | 'acknowledged'>) => void;
  acknowledgeAlert: (alertId: string) => void;
  acknowledgeAllAlerts: () => void;
  clearAlerts: () => void;

  // Actions - Settings
  toggleSound: () => void;
  setVolume: (volume: number) => void;
  toggleNotifications: () => void;

  // Actions - Connection
  setWsConnected: (connected: boolean) => void;
  recordPing: () => void;

  // Actions - Permissions
  setCameraPermission: (status: 'pending' | 'granted' | 'denied') => void;
  setMicPermission: (status: 'pending' | 'granted' | 'denied') => void;
}

// =============================================================================
// Store
// =============================================================================

export const useMonitoringStore = create<MonitoringState>((set, get) => ({
  // Initial state
  isStreaming: false,
  streamId: null,
  streamInfo: null,
  motionScore: 0,
  audioLevel: 0,
  lastFrameTime: 0,
  alerts: [],
  activeAlerts: 0,
  unacknowledgedAlerts: 0,
  soundEnabled: true,
  volume: 70,
  notificationsEnabled: true,
  wsConnected: false,
  lastPing: 0,
  cameraPermission: 'pending',
  micPermission: 'pending',

  // Actions - Stream
  startStream: (streamId, scenario) =>
    set({
      isStreaming: true,
      streamId,
      streamInfo: {
        id: streamId,
        scenario,
        status: 'connecting',
        startedAt: new Date().toISOString(),
        motionScore: 0,
        audioLevel: 0,
        lastAnalysisAt: null,
      },
    }),

  stopStream: () =>
    set({
      isStreaming: false,
      streamId: null,
      streamInfo: null,
      motionScore: 0,
      audioLevel: 0,
    }),

  updateStreamStatus: (status) =>
    set((state) => ({
      streamInfo: state.streamInfo
        ? { ...state.streamInfo, status }
        : null,
    })),

  // Actions - Metrics
  updateMotionScore: (score) =>
    set((state) => ({
      motionScore: score,
      streamInfo: state.streamInfo
        ? { ...state.streamInfo, motionScore: score }
        : null,
    })),

  updateAudioLevel: (level) =>
    set((state) => ({
      audioLevel: level,
      streamInfo: state.streamInfo
        ? { ...state.streamInfo, audioLevel: level }
        : null,
    })),

  recordFrame: () => set({ lastFrameTime: Date.now() }),

  // Actions - Alerts
  addAlert: (alertData) =>
    set((state) => {
      const newAlert: Alert = {
        ...alertData,
        id: Math.random().toString(36).slice(2),
        timestamp: new Date().toISOString(),
        acknowledged: false,
        escalationLevel: 0,
      };

      const alerts = [newAlert, ...state.alerts].slice(0, 100); // Keep last 100
      const unacknowledgedAlerts = alerts.filter((a) => !a.acknowledged).length;

      return {
        alerts,
        activeAlerts: unacknowledgedAlerts,
        unacknowledgedAlerts,
      };
    }),

  acknowledgeAlert: (alertId) =>
    set((state) => {
      const alerts = state.alerts.map((a) =>
        a.id === alertId ? { ...a, acknowledged: true } : a
      );
      const unacknowledgedAlerts = alerts.filter((a) => !a.acknowledged).length;

      return {
        alerts,
        activeAlerts: unacknowledgedAlerts,
        unacknowledgedAlerts,
      };
    }),

  acknowledgeAllAlerts: () =>
    set((state) => ({
      alerts: state.alerts.map((a) => ({ ...a, acknowledged: true })),
      activeAlerts: 0,
      unacknowledgedAlerts: 0,
    })),

  clearAlerts: () =>
    set({
      alerts: [],
      activeAlerts: 0,
      unacknowledgedAlerts: 0,
    }),

  // Actions - Settings
  toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),

  setVolume: (volume) => set({ volume: Math.max(0, Math.min(100, volume)) }),

  toggleNotifications: () =>
    set((state) => ({ notificationsEnabled: !state.notificationsEnabled })),

  // Actions - Connection
  setWsConnected: (connected) => set({ wsConnected: connected }),

  recordPing: () => set({ lastPing: Date.now() }),

  // Actions - Permissions
  setCameraPermission: (status) => set({ cameraPermission: status }),

  setMicPermission: (status) => set({ micPermission: status }),
}));

// =============================================================================
// Selectors
// =============================================================================

export const selectIsStreaming = (state: MonitoringState) => state.isStreaming;
export const selectStreamId = (state: MonitoringState) => state.streamId;
export const selectMotionScore = (state: MonitoringState) => state.motionScore;
export const selectAudioLevel = (state: MonitoringState) => state.audioLevel;
export const selectAlerts = (state: MonitoringState) => state.alerts;
export const selectActiveAlerts = (state: MonitoringState) => state.activeAlerts;
export const selectSoundEnabled = (state: MonitoringState) => state.soundEnabled;
export const selectVolume = (state: MonitoringState) => state.volume;

// =============================================================================
// Computed Selectors
// =============================================================================

export const selectCriticalAlerts = (state: MonitoringState) =>
  state.alerts.filter((a) => a.severity === 'critical' && !a.acknowledged);

export const selectRecentAlerts = (state: MonitoringState) =>
  state.alerts.slice(0, 10);

export const selectIsHealthy = (state: MonitoringState) =>
  state.wsConnected && Date.now() - state.lastPing < 30000;

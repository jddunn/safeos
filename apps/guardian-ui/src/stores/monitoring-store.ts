/**
 * Monitoring Store
 *
 * Zustand state management for monitoring features.
 *
 * @module stores/monitoring-store
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// =============================================================================
// Types
// =============================================================================

export type MonitoringScenario = 'pet' | 'baby' | 'elderly';
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface MonitoringProfile {
  id: string;
  name: string;
  scenario: MonitoringScenario;
  motionThreshold: number;
  audioThreshold: number;
  alertSpeed: 'slow' | 'normal' | 'fast' | 'immediate';
  description: string;
  customPrompt?: string;
}

export interface Stream {
  id: string;
  name: string;
  profileId: string;
  status: 'active' | 'paused' | 'disconnected';
  createdAt: string;
  lastFrameAt?: string;
}

export interface Alert {
  id: string;
  streamId: string;
  alertType: 'motion' | 'audio' | 'concern' | 'system';
  severity: 'info' | 'warning' | 'urgent' | 'critical';
  message: string;
  escalationLevel: number;
  acknowledged: boolean;
  createdAt: string;
}

export interface MonitoringState {
  // Connection
  connectionState: ConnectionState;
  
  // Current session
  currentStreamId: string | null;
  currentProfile: MonitoringProfile | null;
  isMonitoring: boolean;
  
  // Detection metrics
  motionScore: number;
  audioLevel: number;
  lastFrameTime: number | null;
  framesAnalyzed: number;
  
  // Alerts
  alerts: Alert[];
  activeAlertId: string | null;
  
  // Settings
  soundEnabled: boolean;
  volume: number;
  notificationsEnabled: boolean;
  
  // Available data
  profiles: MonitoringProfile[];
  streams: Stream[];
}

export interface MonitoringActions {
  // Connection
  setConnectionState: (state: ConnectionState) => void;
  
  // Session
  startMonitoring: (streamId: string, profile: MonitoringProfile) => void;
  stopMonitoring: () => void;
  pauseMonitoring: () => void;
  resumeMonitoring: () => void;
  
  // Metrics
  updateMetrics: (motion: number, audio: number) => void;
  incrementFramesAnalyzed: () => void;
  
  // Alerts
  addAlert: (alert: Alert) => void;
  acknowledgeAlert: (alertId: string) => void;
  acknowledgeAllAlerts: () => void;
  setActiveAlert: (alertId: string | null) => void;
  
  // Settings
  setVolume: (volume: number) => void;
  toggleSound: () => void;
  toggleNotifications: () => void;
  
  // Data
  setProfiles: (profiles: MonitoringProfile[]) => void;
  setStreams: (streams: Stream[]) => void;
  addStream: (stream: Stream) => void;
  removeStream: (streamId: string) => void;
  
  // Reset
  reset: () => void;
}

// =============================================================================
// Initial State
// =============================================================================

const initialState: MonitoringState = {
  connectionState: 'disconnected',
  currentStreamId: null,
  currentProfile: null,
  isMonitoring: false,
  motionScore: 0,
  audioLevel: 0,
  lastFrameTime: null,
  framesAnalyzed: 0,
  alerts: [],
  activeAlertId: null,
  soundEnabled: true,
  volume: 50,
  notificationsEnabled: true,
  profiles: [],
  streams: [],
};

// =============================================================================
// Store
// =============================================================================

export const useMonitoringStore = create<MonitoringState & MonitoringActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Connection
      setConnectionState: (connectionState) => set({ connectionState }),

      // Session
      startMonitoring: (streamId, profile) =>
        set({
          currentStreamId: streamId,
          currentProfile: profile,
          isMonitoring: true,
          motionScore: 0,
          audioLevel: 0,
          lastFrameTime: null,
          framesAnalyzed: 0,
        }),

      stopMonitoring: () =>
        set({
          currentStreamId: null,
          currentProfile: null,
          isMonitoring: false,
          motionScore: 0,
          audioLevel: 0,
          lastFrameTime: null,
        }),

      pauseMonitoring: () => set({ isMonitoring: false }),

      resumeMonitoring: () => set({ isMonitoring: true }),

      // Metrics
      updateMetrics: (motion, audio) =>
        set({
          motionScore: motion,
          audioLevel: audio,
          lastFrameTime: Date.now(),
        }),

      incrementFramesAnalyzed: () =>
        set((state) => ({ framesAnalyzed: state.framesAnalyzed + 1 })),

      // Alerts
      addAlert: (alert) =>
        set((state) => ({
          alerts: [alert, ...state.alerts].slice(0, 100), // Keep last 100
          activeAlertId: state.activeAlertId || alert.id,
        })),

      acknowledgeAlert: (alertId) =>
        set((state) => ({
          alerts: state.alerts.map((a) =>
            a.id === alertId ? { ...a, acknowledged: true } : a
          ),
          activeAlertId:
            state.activeAlertId === alertId
              ? state.alerts.find((a) => a.id !== alertId && !a.acknowledged)?.id || null
              : state.activeAlertId,
        })),

      acknowledgeAllAlerts: () =>
        set((state) => ({
          alerts: state.alerts.map((a) => ({ ...a, acknowledged: true })),
          activeAlertId: null,
        })),

      setActiveAlert: (alertId) => set({ activeAlertId: alertId }),

      // Settings
      setVolume: (volume) => set({ volume: Math.max(0, Math.min(100, volume)) }),

      toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),

      toggleNotifications: () =>
        set((state) => ({ notificationsEnabled: !state.notificationsEnabled })),

      // Data
      setProfiles: (profiles) => set({ profiles }),

      setStreams: (streams) => set({ streams }),

      addStream: (stream) =>
        set((state) => ({
          streams: [stream, ...state.streams],
        })),

      removeStream: (streamId) =>
        set((state) => ({
          streams: state.streams.filter((s) => s.id !== streamId),
        })),

      // Reset
      reset: () => set(initialState),
    }),
    {
      name: 'safeos-monitoring-store',
      partialize: (state) => ({
        // Only persist user preferences, not session data
        soundEnabled: state.soundEnabled,
        volume: state.volume,
        notificationsEnabled: state.notificationsEnabled,
      }),
    }
  )
);


/**
 * Alert Escalation Manager
 *
 * Manages alert escalation with volume ramping and multi-channel notifications.
 *
 * Escalation Timeline:
 * - T+0s:   Visual indicator (no sound)
 * - T+15s:  Gentle chime (10% volume)
 * - T+45s:  Alert sound (25% → 50% ramping)
 * - T+105s: Alarm (50% → 100% ramping)
 * - T+225s: Critical (max volume, external notifications)
 *
 * @module lib/alerts/escalation
 */

import type { Alert, AlertSeverity, AlertEscalation } from '../../types/index.js';

// =============================================================================
// Escalation Configuration
// =============================================================================

export const ESCALATION_LEVELS: AlertEscalation[] = [
  {
    level: 0,
    delaySeconds: 0,
    volume: 0,
    sound: 'none',
    notify: [],
  },
  {
    level: 1,
    delaySeconds: 15,
    volume: 10,
    sound: 'chime',
    notify: ['browser'],
  },
  {
    level: 2,
    delaySeconds: 45,
    volume: 25,
    sound: 'alert',
    notify: ['browser'],
  },
  {
    level: 3,
    delaySeconds: 105,
    volume: 50,
    sound: 'alarm',
    notify: ['browser', 'telegram'],
  },
  {
    level: 4,
    delaySeconds: 225,
    volume: 100,
    sound: 'critical',
    notify: ['browser', 'sms', 'telegram'],
  },
];

// Severity to starting escalation level mapping
const SEVERITY_START_LEVEL: Record<AlertSeverity, number> = {
  info: 0,
  warning: 1,
  urgent: 2,
  critical: 3,
};

// =============================================================================
// Alert Escalation Manager
// =============================================================================

interface ActiveAlert {
  alert: Alert;
  currentLevel: number;
  startTime: number;
  escalationTimer?: ReturnType<typeof setTimeout>;
  acknowledged: boolean;
}

type EscalationCallback = (alert: Alert, escalation: AlertEscalation) => void | Promise<void>;

export class AlertEscalationManager {
  private activeAlerts: Map<string, ActiveAlert> = new Map();
  private onEscalate: EscalationCallback | null = null;
  private onAcknowledge: ((alertId: string) => void) | null = null;

  constructor() {}

  // ===========================================================================
  // Event Handlers
  // ===========================================================================

  /**
   * Set callback for escalation events
   */
  setOnEscalate(callback: EscalationCallback): void {
    this.onEscalate = callback;
  }

  /**
   * Set callback for acknowledgment events
   */
  setOnAcknowledge(callback: (alertId: string) => void): void {
    this.onAcknowledge = callback;
  }

  // ===========================================================================
  // Alert Management
  // ===========================================================================

  /**
   * Start tracking a new alert
   */
  startAlert(alert: Alert): void {
    // Don't track if already exists
    if (this.activeAlerts.has(alert.id)) {
      return;
    }

    const startLevel = SEVERITY_START_LEVEL[alert.severity];
    const escalation = ESCALATION_LEVELS[startLevel];

    const activeAlert: ActiveAlert = {
      alert,
      currentLevel: startLevel,
      startTime: Date.now(),
      acknowledged: false,
    };

    this.activeAlerts.set(alert.id, activeAlert);

    // Trigger initial escalation
    if (escalation) {
      this.triggerEscalation(alert.id, escalation);
    }

    // Schedule next escalation if not at max level
    this.scheduleNextEscalation(alert.id);

    console.log(`[AlertEscalation] Started tracking alert ${alert.id} at level ${startLevel}`);
  }

  /**
   * Acknowledge an alert (stops escalation)
   */
  acknowledgeAlert(alertId: string): boolean {
    const activeAlert = this.activeAlerts.get(alertId);
    if (!activeAlert) {
      return false;
    }

    // Clear escalation timer
    if (activeAlert.escalationTimer) {
      clearTimeout(activeAlert.escalationTimer);
    }

    activeAlert.acknowledged = true;
    this.activeAlerts.delete(alertId);

    if (this.onAcknowledge) {
      this.onAcknowledge(alertId);
    }

    console.log(`[AlertEscalation] Alert ${alertId} acknowledged`);
    return true;
  }

  /**
   * Get current escalation level for an alert
   */
  getAlertLevel(alertId: string): number {
    return this.activeAlerts.get(alertId)?.currentLevel ?? -1;
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values()).map((a) => a.alert);
  }

  /**
   * Clear all active alerts
   */
  clearAll(): void {
    for (const [alertId, activeAlert] of this.activeAlerts) {
      if (activeAlert.escalationTimer) {
        clearTimeout(activeAlert.escalationTimer);
      }
    }
    this.activeAlerts.clear();
    console.log('[AlertEscalation] Cleared all alerts');
  }

  // ===========================================================================
  // Escalation Logic
  // ===========================================================================

  private scheduleNextEscalation(alertId: string): void {
    const activeAlert = this.activeAlerts.get(alertId);
    if (!activeAlert || activeAlert.acknowledged) {
      return;
    }

    const nextLevel = activeAlert.currentLevel + 1;
    if (nextLevel >= ESCALATION_LEVELS.length) {
      // Already at max level
      return;
    }

    const currentEscalation = ESCALATION_LEVELS[activeAlert.currentLevel];
    const nextEscalation = ESCALATION_LEVELS[nextLevel];

    if (!currentEscalation || !nextEscalation) {
      return;
    }

    const delayMs = (nextEscalation.delaySeconds - currentEscalation.delaySeconds) * 1000;

    activeAlert.escalationTimer = setTimeout(() => {
      this.escalateAlert(alertId);
    }, delayMs);
  }

  private escalateAlert(alertId: string): void {
    const activeAlert = this.activeAlerts.get(alertId);
    if (!activeAlert || activeAlert.acknowledged) {
      return;
    }

    const nextLevel = activeAlert.currentLevel + 1;
    if (nextLevel >= ESCALATION_LEVELS.length) {
      return;
    }

    activeAlert.currentLevel = nextLevel;
    const escalation = ESCALATION_LEVELS[nextLevel];

    if (escalation) {
      this.triggerEscalation(alertId, escalation);
    }

    // Schedule next escalation
    this.scheduleNextEscalation(alertId);

    console.log(`[AlertEscalation] Alert ${alertId} escalated to level ${nextLevel}`);
  }

  private triggerEscalation(alertId: string, escalation: AlertEscalation): void {
    const activeAlert = this.activeAlerts.get(alertId);
    if (!activeAlert) {
      return;
    }

    // Update alert with new escalation level
    activeAlert.alert.escalationLevel = escalation.level;

    if (this.onEscalate) {
      void this.onEscalate(activeAlert.alert, escalation);
    }
  }

  // ===========================================================================
  // Volume Ramping
  // ===========================================================================

  /**
   * Calculate current volume based on escalation level and time
   */
  getVolume(alertId: string): number {
    const activeAlert = this.activeAlerts.get(alertId);
    if (!activeAlert) {
      return 0;
    }

    const currentEscalation = ESCALATION_LEVELS[activeAlert.currentLevel];
    const nextEscalation = ESCALATION_LEVELS[activeAlert.currentLevel + 1];

    if (!currentEscalation) {
      return 0;
    }

    if (!nextEscalation) {
      // At max level, return max volume
      return currentEscalation.volume;
    }

    // Calculate time progress to next level
    const elapsedMs = Date.now() - activeAlert.startTime;
    const currentDelayMs = currentEscalation.delaySeconds * 1000;
    const nextDelayMs = nextEscalation.delaySeconds * 1000;
    const progress = Math.min(
      1,
      (elapsedMs - currentDelayMs) / (nextDelayMs - currentDelayMs)
    );

    // Linear interpolation between current and next volume
    const volumeRange = nextEscalation.volume - currentEscalation.volume;
    return Math.round(currentEscalation.volume + volumeRange * progress);
  }

  /**
   * Get the sound to play for an alert
   */
  getSound(alertId: string): 'none' | 'chime' | 'alert' | 'alarm' | 'critical' {
    const activeAlert = this.activeAlerts.get(alertId);
    if (!activeAlert) {
      return 'none';
    }

    return ESCALATION_LEVELS[activeAlert.currentLevel]?.sound || 'none';
  }

  // ===========================================================================
  // Stats
  // ===========================================================================

  getStats(): {
    activeCount: number;
    byLevel: Record<number, number>;
  } {
    const byLevel: Record<number, number> = {};

    for (const activeAlert of this.activeAlerts.values()) {
      byLevel[activeAlert.currentLevel] = (byLevel[activeAlert.currentLevel] || 0) + 1;
    }

    return {
      activeCount: this.activeAlerts.size,
      byLevel,
    };
  }
}

// =============================================================================
// Singleton
// =============================================================================

let defaultManager: AlertEscalationManager | null = null;

export function getDefaultEscalationManager(): AlertEscalationManager {
  if (!defaultManager) {
    defaultManager = new AlertEscalationManager();
  }
  return defaultManager;
}


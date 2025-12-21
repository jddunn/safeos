/**
 * Alert Escalation Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AlertEscalationManager,
  ESCALATION_LEVELS,
} from '../src/lib/alerts/escalation.js';
import type { Alert } from '../src/types/index.js';

describe('AlertEscalationManager', () => {
  let manager: AlertEscalationManager;

  beforeEach(() => {
    manager = new AlertEscalationManager();
  });

  const createAlert = (severity: Alert['severity']): Alert => ({
    id: `alert-${Date.now()}`,
    streamId: 'stream-1',
    alertType: 'concern',
    severity,
    message: 'Test alert',
    escalationLevel: 0,
    acknowledged: false,
    createdAt: new Date().toISOString(),
  });

  describe('escalation levels', () => {
    it('should have 5 escalation levels', () => {
      expect(ESCALATION_LEVELS).toHaveLength(5);
    });

    it('should have increasing delays', () => {
      for (let i = 1; i < ESCALATION_LEVELS.length; i++) {
        expect(ESCALATION_LEVELS[i].delaySeconds).toBeGreaterThan(
          ESCALATION_LEVELS[i - 1].delaySeconds
        );
      }
    });

    it('should have increasing volumes', () => {
      for (let i = 1; i < ESCALATION_LEVELS.length; i++) {
        expect(ESCALATION_LEVELS[i].volume).toBeGreaterThanOrEqual(
          ESCALATION_LEVELS[i - 1].volume
        );
      }
    });
  });

  describe('alert tracking', () => {
    it('should start tracking a new alert', () => {
      const alert = createAlert('warning');
      manager.startAlert(alert);

      const level = manager.getAlertLevel(alert.id);
      expect(level).toBe(1); // Warning starts at level 1
    });

    it('should acknowledge an alert', () => {
      const alert = createAlert('warning');
      manager.startAlert(alert);

      const result = manager.acknowledgeAlert(alert.id);
      expect(result).toBe(true);

      const level = manager.getAlertLevel(alert.id);
      expect(level).toBe(-1); // Not found after acknowledgment
    });

    it('should return false when acknowledging non-existent alert', () => {
      const result = manager.acknowledgeAlert('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('severity to level mapping', () => {
    it('should start info alerts at level 0', () => {
      const alert = createAlert('info');
      manager.startAlert(alert);
      expect(manager.getAlertLevel(alert.id)).toBe(0);
    });

    it('should start warning alerts at level 1', () => {
      const alert = createAlert('warning');
      manager.startAlert(alert);
      expect(manager.getAlertLevel(alert.id)).toBe(1);
    });

    it('should start urgent alerts at level 2', () => {
      const alert = createAlert('urgent');
      manager.startAlert(alert);
      expect(manager.getAlertLevel(alert.id)).toBe(2);
    });

    it('should start critical alerts at level 3', () => {
      const alert = createAlert('critical');
      manager.startAlert(alert);
      expect(manager.getAlertLevel(alert.id)).toBe(3);
    });
  });

  describe('escalation callbacks', () => {
    it('should call onEscalate when escalating', () => {
      const onEscalate = vi.fn();
      manager.setOnEscalate(onEscalate);

      const alert = createAlert('warning');
      manager.startAlert(alert);

      // Initial escalation
      expect(onEscalate).toHaveBeenCalledWith(
        expect.objectContaining({ id: alert.id }),
        expect.objectContaining({ level: 1 })
      );
    });

    it('should call onAcknowledge when acknowledged', () => {
      const onAcknowledge = vi.fn();
      manager.setOnAcknowledge(onAcknowledge);

      const alert = createAlert('warning');
      manager.startAlert(alert);
      manager.acknowledgeAlert(alert.id);

      expect(onAcknowledge).toHaveBeenCalledWith(alert.id);
    });
  });

  describe('volume calculation', () => {
    it('should return 0 for unknown alerts', () => {
      expect(manager.getVolume('unknown')).toBe(0);
    });

    it('should return appropriate volume for level', () => {
      const alert = createAlert('warning');
      manager.startAlert(alert);

      const volume = manager.getVolume(alert.id);
      expect(volume).toBeGreaterThanOrEqual(0);
      expect(volume).toBeLessThanOrEqual(100);
    });
  });

  describe('sound selection', () => {
    it('should return none for unknown alerts', () => {
      expect(manager.getSound('unknown')).toBe('none');
    });

    it('should return appropriate sound for severity', () => {
      const alert = createAlert('critical');
      manager.startAlert(alert);

      const sound = manager.getSound(alert.id);
      expect(['chime', 'alert', 'alarm', 'critical']).toContain(sound);
    });
  });

  describe('statistics', () => {
    it('should track active alerts', () => {
      manager.startAlert(createAlert('info'));
      manager.startAlert(createAlert('warning'));
      manager.startAlert(createAlert('urgent'));

      const stats = manager.getStats();
      expect(stats.activeCount).toBe(3);
    });

    it('should track alerts by level', () => {
      manager.startAlert(createAlert('warning'));
      manager.startAlert(createAlert('warning'));
      manager.startAlert(createAlert('critical'));

      const stats = manager.getStats();
      expect(stats.byLevel[1]).toBe(2); // Two warnings at level 1
      expect(stats.byLevel[3]).toBe(1); // One critical at level 3
    });
  });

  describe('cleanup', () => {
    it('should clear all alerts', () => {
      manager.startAlert(createAlert('info'));
      manager.startAlert(createAlert('warning'));
      manager.startAlert(createAlert('urgent'));

      manager.clearAll();

      const stats = manager.getStats();
      expect(stats.activeCount).toBe(0);
    });
  });
});


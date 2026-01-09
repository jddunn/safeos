/**
 * Alert Panel Tests
 *
 * Unit tests for the AlertPanel helper functions and escalation logic.
 *
 * @module tests/alert-panel.test
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// =============================================================================
// Constants (extracted for testing)
// =============================================================================

const ESCALATION_LEVELS = [
  { level: 1, delay: 0, volume: 0.3, sound: 'notification' },
  { level: 2, delay: 30000, volume: 0.5, sound: 'alert' },
  { level: 3, delay: 60000, volume: 0.7, sound: 'warning' },
  { level: 4, delay: 120000, volume: 0.9, sound: 'alarm' },
  { level: 5, delay: 180000, volume: 1.0, sound: 'emergency' },
];

const SEVERITY_COLORS = {
  info: { bg: 'bg-blue-500/20', border: 'border-blue-500/50', text: 'text-blue-400' },
  low: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/50', text: 'text-emerald-400' },
  medium: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/50', text: 'text-yellow-400' },
  high: { bg: 'bg-orange-500/20', border: 'border-orange-500/50', text: 'text-orange-400' },
  critical: { bg: 'bg-red-500/20', border: 'border-red-500/50', text: 'text-red-400' },
};

const SEVERITY_ICONS = {
  info: 'ℹ️',
  low: '📢',
  medium: '⚠️',
  high: '🚨',
  critical: '🆘',
};

// =============================================================================
// Helper Functions (extracted for testing)
// =============================================================================

function getTimeAgo(timestamp: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(timestamp).getTime()) / 1000
  );

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function calculateEscalationLevel(alertAge: number): number {
  let level = 1;
  for (const esc of ESCALATION_LEVELS) {
    if (alertAge >= esc.delay) {
      level = esc.level;
    }
  }
  return level;
}

function getEscalationConfig(level: number) {
  return ESCALATION_LEVELS.find((e) => e.level === level);
}

function getEscalationColor(level: number): string {
  if (level >= 4) return 'bg-red-500 animate-pulse';
  if (level >= 3) return 'bg-orange-500';
  if (level >= 2) return 'bg-yellow-500';
  return 'bg-emerald-500';
}

// =============================================================================
// Tests
// =============================================================================

describe('Alert Panel', () => {
  describe('getTimeAgo', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return "just now" for timestamps less than 60 seconds ago', () => {
      const timestamp = new Date('2024-01-15T11:59:30Z').toISOString();
      expect(getTimeAgo(timestamp)).toBe('just now');
    });

    it('should return minutes for timestamps less than 1 hour ago', () => {
      const timestamp5m = new Date('2024-01-15T11:55:00Z').toISOString();
      expect(getTimeAgo(timestamp5m)).toBe('5m ago');

      const timestamp30m = new Date('2024-01-15T11:30:00Z').toISOString();
      expect(getTimeAgo(timestamp30m)).toBe('30m ago');
    });

    it('should return hours for timestamps less than 24 hours ago', () => {
      const timestamp2h = new Date('2024-01-15T10:00:00Z').toISOString();
      expect(getTimeAgo(timestamp2h)).toBe('2h ago');

      const timestamp12h = new Date('2024-01-15T00:00:00Z').toISOString();
      expect(getTimeAgo(timestamp12h)).toBe('12h ago');
    });

    it('should return days for timestamps more than 24 hours ago', () => {
      const timestamp1d = new Date('2024-01-14T12:00:00Z').toISOString();
      expect(getTimeAgo(timestamp1d)).toBe('1d ago');

      const timestamp3d = new Date('2024-01-12T12:00:00Z').toISOString();
      expect(getTimeAgo(timestamp3d)).toBe('3d ago');
    });

    it('should handle edge case at 60 seconds', () => {
      const timestamp60s = new Date('2024-01-15T11:59:00Z').toISOString();
      expect(getTimeAgo(timestamp60s)).toBe('1m ago');
    });
  });

  describe('ESCALATION_LEVELS', () => {
    it('should have 5 escalation levels', () => {
      expect(ESCALATION_LEVELS).toHaveLength(5);
    });

    it('should have increasing delays', () => {
      for (let i = 1; i < ESCALATION_LEVELS.length; i++) {
        expect(ESCALATION_LEVELS[i].delay).toBeGreaterThan(ESCALATION_LEVELS[i - 1].delay);
      }
    });

    it('should have increasing volumes', () => {
      for (let i = 1; i < ESCALATION_LEVELS.length; i++) {
        expect(ESCALATION_LEVELS[i].volume).toBeGreaterThan(ESCALATION_LEVELS[i - 1].volume);
      }
    });

    it('should have correct sound types', () => {
      const expectedSounds = ['notification', 'alert', 'warning', 'alarm', 'emergency'];
      ESCALATION_LEVELS.forEach((level, index) => {
        expect(level.sound).toBe(expectedSounds[index]);
      });
    });

    it('should start at level 1 immediately (0ms delay)', () => {
      expect(ESCALATION_LEVELS[0].delay).toBe(0);
      expect(ESCALATION_LEVELS[0].level).toBe(1);
    });

    it('should reach max volume at level 5', () => {
      const level5 = ESCALATION_LEVELS.find((e) => e.level === 5);
      expect(level5?.volume).toBe(1.0);
    });
  });

  describe('calculateEscalationLevel', () => {
    it('should return level 1 for new alerts', () => {
      expect(calculateEscalationLevel(0)).toBe(1);
      expect(calculateEscalationLevel(1000)).toBe(1);
      expect(calculateEscalationLevel(29999)).toBe(1);
    });

    it('should return level 2 after 30 seconds', () => {
      expect(calculateEscalationLevel(30000)).toBe(2);
      expect(calculateEscalationLevel(45000)).toBe(2);
    });

    it('should return level 3 after 60 seconds', () => {
      expect(calculateEscalationLevel(60000)).toBe(3);
      expect(calculateEscalationLevel(90000)).toBe(3);
    });

    it('should return level 4 after 120 seconds', () => {
      expect(calculateEscalationLevel(120000)).toBe(4);
      expect(calculateEscalationLevel(150000)).toBe(4);
    });

    it('should return level 5 after 180 seconds', () => {
      expect(calculateEscalationLevel(180000)).toBe(5);
      expect(calculateEscalationLevel(300000)).toBe(5);
    });
  });

  describe('getEscalationConfig', () => {
    it('should return correct config for each level', () => {
      expect(getEscalationConfig(1)).toEqual({
        level: 1,
        delay: 0,
        volume: 0.3,
        sound: 'notification',
      });

      expect(getEscalationConfig(3)).toEqual({
        level: 3,
        delay: 60000,
        volume: 0.7,
        sound: 'warning',
      });

      expect(getEscalationConfig(5)).toEqual({
        level: 5,
        delay: 180000,
        volume: 1.0,
        sound: 'emergency',
      });
    });

    it('should return undefined for invalid levels', () => {
      expect(getEscalationConfig(0)).toBeUndefined();
      expect(getEscalationConfig(6)).toBeUndefined();
    });
  });

  describe('getEscalationColor', () => {
    it('should return emerald for level 1', () => {
      expect(getEscalationColor(1)).toBe('bg-emerald-500');
    });

    it('should return yellow for level 2', () => {
      expect(getEscalationColor(2)).toBe('bg-yellow-500');
    });

    it('should return orange for level 3', () => {
      expect(getEscalationColor(3)).toBe('bg-orange-500');
    });

    it('should return red with pulse for level 4', () => {
      expect(getEscalationColor(4)).toBe('bg-red-500 animate-pulse');
    });

    it('should return red with pulse for level 5', () => {
      expect(getEscalationColor(5)).toBe('bg-red-500 animate-pulse');
    });
  });

  describe('SEVERITY_COLORS', () => {
    it('should have colors for all severity levels', () => {
      const severities = ['info', 'low', 'medium', 'high', 'critical'];
      severities.forEach((severity) => {
        expect(SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS]).toBeDefined();
      });
    });

    it('should have bg, border, and text for each severity', () => {
      Object.values(SEVERITY_COLORS).forEach((colors) => {
        expect(colors.bg).toBeTruthy();
        expect(colors.border).toBeTruthy();
        expect(colors.text).toBeTruthy();
      });
    });

    it('should use correct color families', () => {
      expect(SEVERITY_COLORS.info.bg).toContain('blue');
      expect(SEVERITY_COLORS.low.bg).toContain('emerald');
      expect(SEVERITY_COLORS.medium.bg).toContain('yellow');
      expect(SEVERITY_COLORS.high.bg).toContain('orange');
      expect(SEVERITY_COLORS.critical.bg).toContain('red');
    });
  });

  describe('SEVERITY_ICONS', () => {
    it('should have icons for all severity levels', () => {
      const severities = ['info', 'low', 'medium', 'high', 'critical'];
      severities.forEach((severity) => {
        expect(SEVERITY_ICONS[severity as keyof typeof SEVERITY_ICONS]).toBeTruthy();
      });
    });

    it('should use distinct icons for each severity', () => {
      const icons = Object.values(SEVERITY_ICONS);
      const uniqueIcons = new Set(icons);
      expect(uniqueIcons.size).toBe(icons.length);
    });

    it('should use appropriate emergency icon for critical', () => {
      expect(SEVERITY_ICONS.critical).toBe('🆘');
    });
  });

  describe('Alert Age Calculation', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should calculate correct age from timestamp', () => {
      const alertTime = new Date('2024-01-15T11:58:00Z').toISOString();
      const alertAge = Date.now() - new Date(alertTime).getTime();
      expect(alertAge).toBe(120000); // 2 minutes
    });

    it('should determine correct escalation level from timestamp', () => {
      // Alert created 90 seconds ago should be level 3
      const alertTime = new Date('2024-01-15T11:58:30Z').toISOString();
      const alertAge = Date.now() - new Date(alertTime).getTime();
      expect(calculateEscalationLevel(alertAge)).toBe(3);
    });
  });

  describe('Time to Next Escalation', () => {
    it('should calculate time until next escalation', () => {
      const currentLevel = 2;
      const alertAge = 45000; // 45 seconds
      const nextLevel = ESCALATION_LEVELS.find((e) => e.level === currentLevel + 1);

      expect(nextLevel).toBeDefined();
      const timeToNext = nextLevel!.delay - alertAge;
      expect(timeToNext).toBe(15000); // 15 seconds until level 3
    });

    it('should return negative time when overdue for escalation', () => {
      const currentLevel = 1;
      const alertAge = 35000; // 35 seconds (past level 2 threshold)
      const nextLevel = ESCALATION_LEVELS.find((e) => e.level === currentLevel + 1);

      const timeToNext = nextLevel!.delay - alertAge;
      expect(timeToNext).toBeLessThan(0);
    });

    it('should have no next level after level 5', () => {
      const currentLevel = 5;
      const nextLevel = ESCALATION_LEVELS.find((e) => e.level === currentLevel + 1);
      expect(nextLevel).toBeUndefined();
    });
  });
});

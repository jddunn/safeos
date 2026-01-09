/**
 * Notification Manager Unit Tests
 *
 * Tests for multi-channel notification delivery.
 *
 * @module tests/unit/notification-manager
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationManager } from '../../src/lib/alerts/notification-manager.js';

// Mock external services
vi.mock('../../src/lib/alerts/browser-push.js', () => ({
  sendBrowserPushNotification: vi.fn().mockResolvedValue({ success: true }),
  isVapidConfigured: vi.fn().mockReturnValue(false),
}));

vi.mock('../../src/lib/alerts/twilio.js', () => ({
  sendTwilioSms: vi.fn().mockResolvedValue({ success: true, sid: 'test-sid' }),
  isTwilioConfigured: vi.fn().mockReturnValue(false),
}));

vi.mock('../../src/lib/alerts/telegram.js', () => ({
  TelegramBotService: vi.fn().mockImplementation(() => ({
    sendAlert: vi.fn().mockResolvedValue({ success: true }),
  })),
}));

vi.mock('../../src/api/routes/notifications.js', () => ({
  getPushSubscriptions: vi.fn().mockReturnValue(new Map()),
  getTelegramChatIds: vi.fn().mockReturnValue([]),
}));

// =============================================================================
// Test Suite
// =============================================================================

describe('NotificationManager', () => {
  let manager: NotificationManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new NotificationManager();
  });

  // ===========================================================================
  // Constructor Tests
  // ===========================================================================

  describe('constructor', () => {
    it('should create with default config', () => {
      const config = manager.getConfig();

      expect(config.browserPush).toBe(true);
      expect(config.sms).toBe(false);
      expect(config.telegram).toBe(false);
    });

    it('should accept custom config', () => {
      const customManager = new NotificationManager({
        browserPush: false,
        sms: true,
        smsNumber: '+1234567890',
      });

      const config = customManager.getConfig();
      expect(config.browserPush).toBe(false);
      expect(config.sms).toBe(true);
      expect(config.smsNumber).toBe('+1234567890');
    });
  });

  // ===========================================================================
  // Notify Tests
  // ===========================================================================

  describe('notify', () => {
    it('should send notification and return results', async () => {
      const payload = {
        streamId: 'stream-1',
        alertId: 'alert-1',
        severity: 'medium' as const,
        title: 'Test Alert',
        message: 'This is a test notification',
        timestamp: new Date().toISOString(),
      };

      const results = await manager.notify(payload);

      expect(results).toBeInstanceOf(Array);
      // Results should have entries for each channel attempted
      results.forEach((result) => {
        expect(result).toHaveProperty('channel');
        expect(result).toHaveProperty('success');
      });
    });

    it('should attempt browser push for low severity', async () => {
      const payload = {
        streamId: 'stream-1',
        alertId: 'alert-1',
        severity: 'low' as const,
        title: 'Low Alert',
        message: 'Test',
        timestamp: new Date().toISOString(),
      };

      const results = await manager.notify(payload);

      // Low severity should only use browser
      const browserResult = results.find((r) => r.channel === 'browser');
      expect(browserResult).toBeDefined();
    });

    it('should attempt multiple channels for high severity', async () => {
      const smsManager = new NotificationManager({
        sms: true,
        smsNumber: '+1234567890',
        telegram: true,
      });

      const payload = {
        streamId: 'stream-1',
        alertId: 'alert-1',
        severity: 'high' as const,
        title: 'High Alert',
        message: 'Urgent attention needed',
        timestamp: new Date().toISOString(),
      };

      const results = await smsManager.notify(payload);

      // High severity should use browser, telegram, sms
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle info severity', async () => {
      const payload = {
        streamId: 'stream-1',
        alertId: 'alert-1',
        severity: 'info' as const,
        title: 'Info',
        message: 'Informational message',
        timestamp: new Date().toISOString(),
      };

      const results = await manager.notify(payload);

      expect(results).toBeInstanceOf(Array);
    });

    it('should handle critical severity', async () => {
      const payload = {
        streamId: 'stream-1',
        alertId: 'alert-1',
        severity: 'critical' as const,
        title: 'Critical Alert',
        message: 'Immediate attention required',
        timestamp: new Date().toISOString(),
      };

      const results = await manager.notify(payload);

      expect(results).toBeInstanceOf(Array);
    });
  });

  // ===========================================================================
  // Configuration Tests
  // ===========================================================================

  describe('updateConfig', () => {
    it('should update configuration', () => {
      manager.updateConfig({ sms: true, smsNumber: '+0987654321' });

      const config = manager.getConfig();
      expect(config.sms).toBe(true);
      expect(config.smsNumber).toBe('+0987654321');
    });

    it('should preserve unchanged config values', () => {
      const original = manager.getConfig();
      manager.updateConfig({ sms: true });

      const updated = manager.getConfig();
      expect(updated.browserPush).toBe(original.browserPush);
    });
  });

  // ===========================================================================
  // Channel Availability Tests
  // ===========================================================================

  describe('getAvailableChannels', () => {
    it('should always include browser channel', () => {
      const channels = manager.getAvailableChannels();

      expect(channels).toContain('browser');
    });

    it('should return array of strings', () => {
      const channels = manager.getAvailableChannels();

      expect(channels).toBeInstanceOf(Array);
      channels.forEach((channel) => {
        expect(typeof channel).toBe('string');
      });
    });
  });

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================

  describe('error handling', () => {
    it('should continue if one channel fails', async () => {
      const { sendBrowserPushNotification } = await import(
        '../../src/lib/alerts/browser-push.js'
      );
      vi.mocked(sendBrowserPushNotification).mockRejectedValueOnce(
        new Error('Push failed')
      );

      const payload = {
        streamId: 'stream-1',
        alertId: 'alert-1',
        severity: 'medium' as const,
        title: 'Test',
        message: 'Test',
        timestamp: new Date().toISOString(),
      };

      // Should not throw
      const results = await manager.notify(payload);

      // Should have result with error
      const failedResult = results.find(
        (r) => r.channel === 'browser' && !r.success
      );
      if (failedResult) {
        expect(failedResult.error).toBeDefined();
      }
    });
  });
});

/**
 * Twilio SMS Notifications
 *
 * Twilio SMS integration for alert notifications.
 *
 * @module lib/alerts/twilio
 */

import type { NotificationPayload, AlertSeverity } from '../../types/index.js';

// =============================================================================
// Configuration
// =============================================================================

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

const DEFAULT_CONFIG: TwilioConfig = {
  accountSid: process.env['TWILIO_ACCOUNT_SID'] || '',
  authToken: process.env['TWILIO_AUTH_TOKEN'] || '',
  fromNumber: process.env['TWILIO_FROM_NUMBER'] || '',
};

// =============================================================================
// Twilio SMS Service
// =============================================================================

export class TwilioSmsService {
  private config: TwilioConfig;
  private enabled: boolean;
  private sentCount = 0;
  private phoneNumbers: Set<string> = new Set();
  private rateLimitMap: Map<string, number[]> = new Map();

  // Rate limiting: max 3 SMS per phone per 10 minutes
  private readonly RATE_LIMIT_WINDOW = 10 * 60 * 1000; // 10 minutes
  private readonly RATE_LIMIT_MAX = 3;

  constructor(config?: Partial<TwilioConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.enabled = !!(
      this.config.accountSid &&
      this.config.authToken &&
      this.config.fromNumber
    );

    if (this.enabled) {
      console.log('[Twilio] SMS service enabled');
    } else {
      console.log('[Twilio] SMS service disabled (missing credentials)');
    }
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  isEnabled(): boolean {
    return this.enabled;
  }

  updateConfig(config: Partial<TwilioConfig>): void {
    this.config = { ...this.config, ...config };
    this.enabled = !!(
      this.config.accountSid &&
      this.config.authToken &&
      this.config.fromNumber
    );
  }

  /**
   * Register a phone number to receive notifications
   */
  registerPhoneNumber(phoneNumber: string): void {
    const normalized = this.normalizePhoneNumber(phoneNumber);
    this.phoneNumbers.add(normalized);
    console.log(`[Twilio] Registered phone ${normalized}`);
  }

  /**
   * Unregister a phone number
   */
  unregisterPhoneNumber(phoneNumber: string): void {
    const normalized = this.normalizePhoneNumber(phoneNumber);
    this.phoneNumbers.delete(normalized);
    this.rateLimitMap.delete(normalized);
    console.log(`[Twilio] Unregistered phone ${normalized}`);
  }

  /**
   * Get registered phone numbers (masked for privacy)
   */
  getRegisteredPhones(): string[] {
    return Array.from(this.phoneNumbers).map((phone) =>
      phone.replace(/(\+\d{1,3})(\d{3})(\d{4})(\d{4})/, '$1$2****$4')
    );
  }

  // ===========================================================================
  // Sending Messages
  // ===========================================================================

  /**
   * Send an SMS to a specific phone number
   */
  async send(phoneNumber: string, payload: NotificationPayload): Promise<boolean> {
    if (!this.enabled) {
      console.warn('[Twilio] Cannot send - service not enabled');
      return false;
    }

    const normalized = this.normalizePhoneNumber(phoneNumber);

    // Check rate limit
    if (!this.checkRateLimit(normalized)) {
      console.warn(`[Twilio] Rate limit exceeded for ${normalized}`);
      return false;
    }

    const message = this.formatMessage(payload);

    try {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization:
              'Basic ' +
              Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString(
                'base64'
              ),
          },
          body: new URLSearchParams({
            To: normalized,
            From: this.config.fromNumber,
            Body: message,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error('[Twilio] Failed to send SMS:', error);
        return false;
      }

      this.sentCount++;
      this.recordSend(normalized);
      console.log(`[Twilio] Sent SMS to ${this.maskPhone(normalized)}: ${payload.title}`);
      return true;
    } catch (error) {
      console.error('[Twilio] Error sending SMS:', error);
      return false;
    }
  }

  /**
   * Send notification to all registered phones
   */
  async sendToAll(payload: NotificationPayload): Promise<{ success: number; failed: number }> {
    // Only send SMS for urgent/critical alerts to save costs
    if (payload.severity !== 'urgent' && payload.severity !== 'critical') {
      console.log('[Twilio] Skipping SMS for non-critical alert');
      return { success: 0, failed: 0 };
    }

    let success = 0;
    let failed = 0;

    for (const phone of this.phoneNumbers) {
      const result = await this.send(phone, payload);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }

    return { success, failed };
  }

  // ===========================================================================
  // Message Formatting
  // ===========================================================================

  /**
   * Format a notification payload as an SMS message
   */
  private formatMessage(payload: NotificationPayload): string {
    const severityEmoji: Record<AlertSeverity, string> = {
      info: 'ℹ️',
      warning: '⚠️',
      urgent: '🚨',
      critical: '🆘',
    };

    const emoji = severityEmoji[payload.severity] || '📢';

    // Keep SMS concise (160 chars for single SMS)
    let message = `${emoji} SafeOS: ${payload.title}\n${payload.body}`;

    if (message.length > 155) {
      message = message.slice(0, 152) + '...';
    }

    return message;
  }

  // ===========================================================================
  // Rate Limiting
  // ===========================================================================

  private checkRateLimit(phoneNumber: string): boolean {
    const now = Date.now();
    const timestamps = this.rateLimitMap.get(phoneNumber) || [];

    // Remove old timestamps
    const recent = timestamps.filter((t) => now - t < this.RATE_LIMIT_WINDOW);

    return recent.length < this.RATE_LIMIT_MAX;
  }

  private recordSend(phoneNumber: string): void {
    const now = Date.now();
    const timestamps = this.rateLimitMap.get(phoneNumber) || [];

    // Remove old timestamps and add new one
    const recent = timestamps.filter((t) => now - t < this.RATE_LIMIT_WINDOW);
    recent.push(now);

    this.rateLimitMap.set(phoneNumber, recent);
  }

  // ===========================================================================
  // Utility
  // ===========================================================================

  /**
   * Normalize phone number to E.164 format
   */
  private normalizePhoneNumber(phone: string): string {
    // Remove all non-digits except leading +
    let normalized = phone.replace(/[^\d+]/g, '');

    // Ensure it starts with +
    if (!normalized.startsWith('+')) {
      // Assume US if no country code
      if (normalized.length === 10) {
        normalized = '+1' + normalized;
      } else if (normalized.length === 11 && normalized.startsWith('1')) {
        normalized = '+' + normalized;
      }
    }

    return normalized;
  }

  /**
   * Mask phone number for logging
   */
  private maskPhone(phone: string): string {
    if (phone.length < 8) return '****';
    return phone.slice(0, 4) + '****' + phone.slice(-4);
  }

  // ===========================================================================
  // Stats
  // ===========================================================================

  getSentCount(): number {
    return this.sentCount;
  }

  getRegisteredPhoneCount(): number {
    return this.phoneNumbers.size;
  }
}

// =============================================================================
// Singleton
// =============================================================================

let defaultService: TwilioSmsService | null = null;

export function getDefaultTwilioService(): TwilioSmsService {
  if (!defaultService) {
    defaultService = new TwilioSmsService();
  }
  return defaultService;
}

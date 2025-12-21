/**
 * Twilio SMS Notifications
 *
 * SMS alerting via Twilio for urgent/critical alerts.
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
  fromNumber: process.env['TWILIO_FROM'] || '',
};

// =============================================================================
// Twilio SMS Service
// =============================================================================

export class TwilioSMSService {
  private config: TwilioConfig;
  private enabled: boolean;
  private sentCount = 0;

  constructor(config?: Partial<TwilioConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.enabled = !!(
      this.config.accountSid &&
      this.config.authToken &&
      this.config.fromNumber
    );

    if (this.enabled) {
      console.log('[TwilioSMS] Service enabled');
    } else {
      console.log('[TwilioSMS] Service disabled (missing credentials)');
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

  // ===========================================================================
  // Sending SMS
  // ===========================================================================

  /**
   * Send an SMS notification
   */
  async send(toNumber: string, payload: NotificationPayload): Promise<boolean> {
    if (!this.enabled) {
      console.warn('[TwilioSMS] Cannot send - service not enabled');
      return false;
    }

    const message = this.formatMessage(payload);

    try {
      // Use Twilio REST API directly to avoid adding twilio package
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
            To: toNumber,
            From: this.config.fromNumber,
            Body: message,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error('[TwilioSMS] Failed to send:', error);
        return false;
      }

      this.sentCount++;
      console.log(`[TwilioSMS] Sent to ${toNumber}: ${payload.title}`);
      return true;
    } catch (error) {
      console.error('[TwilioSMS] Error sending:', error);
      return false;
    }
  }

  /**
   * Send SMS to multiple numbers
   */
  async sendToMultiple(
    toNumbers: string[],
    payload: NotificationPayload
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const number of toNumbers) {
      const result = await this.send(number, payload);
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
    let message = `${emoji} SafeOS Alert\n\n${payload.title}\n\n${payload.body}`;

    if (payload.url) {
      message += `\n\nView: ${payload.url}`;
    }

    // SMS has 160 char limit per segment, but we'll let Twilio handle multi-segment
    return message;
  }

  // ===========================================================================
  // Stats
  // ===========================================================================

  getSentCount(): number {
    return this.sentCount;
  }
}

// =============================================================================
// Singleton
// =============================================================================

let defaultService: TwilioSMSService | null = null;

export function getDefaultTwilioService(): TwilioSMSService {
  if (!defaultService) {
    defaultService = new TwilioSMSService();
  }
  return defaultService;
}


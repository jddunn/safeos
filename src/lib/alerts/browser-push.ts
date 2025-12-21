/**
 * Browser Push Notifications
 *
 * Web Push API integration for browser notifications.
 * Uses VAPID for authentication.
 *
 * @module lib/alerts/browser-push
 */

import type { NotificationPayload, AlertSeverity } from '../../types/index.js';
import { generateId } from '../../db/index.js';

// =============================================================================
// Configuration
// =============================================================================

export interface PushConfig {
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidSubject: string;
}

const DEFAULT_CONFIG: PushConfig = {
  vapidPublicKey: process.env['VAPID_PUBLIC_KEY'] || '',
  vapidPrivateKey: process.env['VAPID_PRIVATE_KEY'] || '',
  vapidSubject: process.env['VAPID_SUBJECT'] || 'mailto:admin@safeos.app',
};

// =============================================================================
// Types
// =============================================================================

export interface PushSubscription {
  id: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  registeredAt: string;
}

// =============================================================================
// Browser Push Service
// =============================================================================

export class BrowserPushService {
  private config: PushConfig;
  private enabled: boolean;
  private subscriptions: Map<string, PushSubscription> = new Map();
  private sentCount = 0;
  private failedSubscriptions: Set<string> = new Set();

  constructor(config?: Partial<PushConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.enabled = !!(this.config.vapidPublicKey && this.config.vapidPrivateKey);

    if (this.enabled) {
      console.log('[Push] Browser push service enabled');
    } else {
      console.log('[Push] Browser push service disabled (missing VAPID keys)');
    }
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  isEnabled(): boolean {
    return this.enabled;
  }

  getPublicKey(): string {
    return this.config.vapidPublicKey;
  }

  updateConfig(config: Partial<PushConfig>): void {
    this.config = { ...this.config, ...config };
    this.enabled = !!(this.config.vapidPublicKey && this.config.vapidPrivateKey);
  }

  // ===========================================================================
  // Subscription Management
  // ===========================================================================

  /**
   * Register a push subscription
   */
  subscribe(subscription: { endpoint: string; keys: { p256dh: string; auth: string } }): string {
    const id = generateId();
    const sub: PushSubscription = {
      id,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      registeredAt: new Date().toISOString(),
    };

    this.subscriptions.set(id, sub);
    console.log(`[Push] Registered subscription ${id}`);

    return id;
  }

  /**
   * Unregister a push subscription
   */
  unsubscribe(subscriptionId: string): void {
    this.subscriptions.delete(subscriptionId);
    this.failedSubscriptions.delete(subscriptionId);
    console.log(`[Push] Unregistered subscription ${subscriptionId}`);
  }

  /**
   * Check if a subscription exists
   */
  hasSubscription(subscriptionId: string): boolean {
    return this.subscriptions.has(subscriptionId);
  }

  // ===========================================================================
  // Sending Notifications
  // ===========================================================================

  /**
   * Send a push notification to a specific subscription
   */
  async sendToSubscription(
    subscriptionId: string,
    payload: NotificationPayload
  ): Promise<boolean> {
    if (!this.enabled) {
      console.warn('[Push] Cannot send - service not enabled');
      return false;
    }

    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      console.warn(`[Push] Subscription ${subscriptionId} not found`);
      return false;
    }

    return this.sendToEndpoint(subscription, payload);
  }

  /**
   * Send notification to all subscriptions
   */
  async sendToAll(payload: NotificationPayload): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const subscription of this.subscriptions.values()) {
      const result = await this.sendToEndpoint(subscription, payload);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * Send to a specific endpoint
   */
  private async sendToEndpoint(
    subscription: PushSubscription,
    payload: NotificationPayload
  ): Promise<boolean> {
    try {
      const pushPayload = this.formatPushPayload(payload);

      // Build the authorization header using VAPID
      const headers = await this.buildVapidHeaders(subscription.endpoint);

      const response = await fetch(subscription.endpoint, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/octet-stream',
          'Content-Encoding': 'aes128gcm',
          TTL: '86400', // 24 hours
        },
        body: await this.encryptPayload(pushPayload, subscription.keys),
      });

      if (response.status === 201) {
        this.sentCount++;
        console.log(`[Push] Sent notification to subscription ${subscription.id}`);
        return true;
      }

      if (response.status === 404 || response.status === 410) {
        // Subscription expired, remove it
        console.log(`[Push] Subscription ${subscription.id} expired, removing`);
        this.subscriptions.delete(subscription.id);
        this.failedSubscriptions.add(subscription.id);
        return false;
      }

      console.error(`[Push] Failed to send: ${response.status} ${response.statusText}`);
      return false;
    } catch (error) {
      console.error('[Push] Error sending notification:', error);
      return false;
    }
  }

  // ===========================================================================
  // Payload Formatting
  // ===========================================================================

  private formatPushPayload(payload: NotificationPayload): string {
    const severityIcon: Record<AlertSeverity, string> = {
      info: '/icons/info.png',
      warning: '/icons/warning.png',
      urgent: '/icons/urgent.png',
      critical: '/icons/critical.png',
    };

    const notification = {
      title: payload.title,
      body: payload.body,
      icon: severityIcon[payload.severity] || '/icons/default.png',
      badge: '/icons/badge.png',
      tag: payload.alertId,
      requireInteraction: payload.severity === 'critical' || payload.severity === 'urgent',
      actions: [
        { action: 'acknowledge', title: 'Acknowledge' },
        { action: 'view', title: 'View Alert' },
      ],
      data: {
        url: payload.url || '/',
        alertId: payload.alertId,
        streamId: payload.streamId,
        severity: payload.severity,
      },
    };

    return JSON.stringify(notification);
  }

  // ===========================================================================
  // VAPID & Encryption (Simplified - in production use web-push library)
  // ===========================================================================

  private async buildVapidHeaders(
    endpoint: string
  ): Promise<{ Authorization: string; 'Crypto-Key': string }> {
    // In production, use the web-push library for proper VAPID header generation
    // This is a placeholder implementation

    // Extract audience from endpoint
    const url = new URL(endpoint);
    const audience = `${url.protocol}//${url.host}`;

    // Create JWT header
    const header = {
      typ: 'JWT',
      alg: 'ES256',
    };

    // Create JWT payload
    const jwtPayload = {
      aud: audience,
      exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, // 12 hours
      sub: this.config.vapidSubject,
    };

    // In production, sign with private key
    // For now, return placeholder
    const token = `${Buffer.from(JSON.stringify(header)).toString('base64url')}.${Buffer.from(JSON.stringify(jwtPayload)).toString('base64url')}.SIGNATURE`;

    return {
      Authorization: `vapid t=${token}, k=${this.config.vapidPublicKey}`,
      'Crypto-Key': `p256ecdsa=${this.config.vapidPublicKey}`,
    };
  }

  private async encryptPayload(
    payload: string,
    keys: { p256dh: string; auth: string }
  ): Promise<Uint8Array> {
    // In production, use proper ECDH encryption
    // This is a placeholder - the actual payload needs to be encrypted
    // using the subscription's p256dh and auth keys

    // For now, return the payload as bytes
    // Real implementation would use aes128gcm encryption
    const encoder = new TextEncoder();
    return encoder.encode(payload);
  }

  // ===========================================================================
  // Stats
  // ===========================================================================

  getSentCount(): number {
    return this.sentCount;
  }

  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  getFailedSubscriptionCount(): number {
    return this.failedSubscriptions.size;
  }
}

// =============================================================================
// Singleton
// =============================================================================

let defaultService: BrowserPushService | null = null;

export function getDefaultPushService(): BrowserPushService {
  if (!defaultService) {
    defaultService = new BrowserPushService();
  }
  return defaultService;
}

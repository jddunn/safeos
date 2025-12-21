/**
 * Browser Push Notifications
 *
 * Web Push API integration for browser notifications.
 *
 * @module lib/alerts/browser-push
 */

import type { NotificationPayload } from '../../types/index.js';

// =============================================================================
// Types
// =============================================================================

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface BrowserPushConfig {
  vapidPublicKey?: string;
  vapidPrivateKey?: string;
}

// =============================================================================
// Browser Push Service
// =============================================================================

export class BrowserPushService {
  private config: BrowserPushConfig;
  private subscriptions: Map<string, PushSubscription> = new Map();

  constructor(config?: BrowserPushConfig) {
    this.config = config || {};
  }

  // ===========================================================================
  // Subscription Management
  // ===========================================================================

  /**
   * Register a push subscription
   */
  registerSubscription(userId: string, subscription: PushSubscription): void {
    this.subscriptions.set(userId, subscription);
    console.log(`[BrowserPush] Registered subscription for ${userId}`);
  }

  /**
   * Remove a push subscription
   */
  unregisterSubscription(userId: string): void {
    this.subscriptions.delete(userId);
    console.log(`[BrowserPush] Unregistered subscription for ${userId}`);
  }

  /**
   * Get subscription count
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  // ===========================================================================
  // Sending Notifications
  // ===========================================================================

  /**
   * Send a push notification to a specific user
   */
  async sendToUser(userId: string, payload: NotificationPayload): Promise<boolean> {
    const subscription = this.subscriptions.get(userId);
    if (!subscription) {
      console.warn(`[BrowserPush] No subscription found for ${userId}`);
      return false;
    }

    return this.sendToSubscription(subscription, payload);
  }

  /**
   * Send a push notification to all subscribers
   */
  async sendToAll(payload: NotificationPayload): Promise<number> {
    let successCount = 0;

    for (const [userId, subscription] of this.subscriptions) {
      try {
        const success = await this.sendToSubscription(subscription, payload);
        if (success) {
          successCount++;
        }
      } catch (error) {
        console.error(`[BrowserPush] Failed to send to ${userId}:`, error);
      }
    }

    return successCount;
  }

  /**
   * Send a push notification to a subscription
   */
  private async sendToSubscription(
    subscription: PushSubscription,
    payload: NotificationPayload
  ): Promise<boolean> {
    // In a real implementation, this would use the web-push library
    // For now, we log and return success
    console.log(`[BrowserPush] Would send to ${subscription.endpoint}:`, payload.title);

    // Note: Actual implementation requires:
    // 1. Install web-push: npm install web-push
    // 2. Generate VAPID keys: npx web-push generate-vapid-keys
    // 3. Use webpush.sendNotification()

    // Placeholder for actual web-push implementation
    /*
    import webpush from 'web-push';
    
    webpush.setVapidDetails(
      'mailto:safety@supercloud.dev',
      this.config.vapidPublicKey,
      this.config.vapidPrivateKey
    );
    
    await webpush.sendNotification(subscription, JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: '/icons/safeos-192.png',
      badge: '/icons/badge-72.png',
      tag: payload.alertId,
      data: {
        url: payload.url || `/alerts/${payload.alertId}`,
        severity: payload.severity,
        streamId: payload.streamId,
      },
    }));
    */

    return true;
  }

  // ===========================================================================
  // Payload Helpers
  // ===========================================================================

  /**
   * Create a notification payload from an alert
   */
  static createPayload(
    title: string,
    body: string,
    options: {
      severity: NotificationPayload['severity'];
      streamId: string;
      alertId: string;
      url?: string;
    }
  ): NotificationPayload {
    return {
      title,
      body,
      severity: options.severity,
      streamId: options.streamId,
      alertId: options.alertId,
      url: options.url,
    };
  }
}

// =============================================================================
// Singleton
// =============================================================================

let defaultService: BrowserPushService | null = null;

export function getDefaultBrowserPushService(): BrowserPushService {
  if (!defaultService) {
    defaultService = new BrowserPushService();
  }
  return defaultService;
}


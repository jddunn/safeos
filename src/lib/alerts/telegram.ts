/**
 * Telegram Bot Notifications
 *
 * Telegram Bot API integration for free notifications.
 *
 * @module lib/alerts/telegram
 */

import type { NotificationPayload, AlertSeverity } from '../../types/index.js';

// =============================================================================
// Configuration
// =============================================================================

export interface TelegramConfig {
  botToken: string;
}

const DEFAULT_CONFIG: TelegramConfig = {
  botToken: process.env['TELEGRAM_BOT_TOKEN'] || '',
};

// =============================================================================
// Telegram Bot Service
// =============================================================================

export class TelegramBotService {
  private config: TelegramConfig;
  private enabled: boolean;
  private sentCount = 0;
  private chatIds: Set<string> = new Set();

  constructor(config?: Partial<TelegramConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.enabled = !!this.config.botToken;

    if (this.enabled) {
      console.log('[Telegram] Bot service enabled');
    } else {
      console.log('[Telegram] Bot service disabled (missing token)');
    }
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  isEnabled(): boolean {
    return this.enabled;
  }

  updateConfig(config: Partial<TelegramConfig>): void {
    this.config = { ...this.config, ...config };
    this.enabled = !!this.config.botToken;
  }

  /**
   * Register a chat ID to receive notifications
   */
  registerChatId(chatId: string): void {
    this.chatIds.add(chatId);
    console.log(`[Telegram] Registered chat ${chatId}`);
  }

  /**
   * Unregister a chat ID
   */
  unregisterChatId(chatId: string): void {
    this.chatIds.delete(chatId);
    console.log(`[Telegram] Unregistered chat ${chatId}`);
  }

  // ===========================================================================
  // Sending Messages
  // ===========================================================================

  /**
   * Send a notification to a specific chat
   */
  async send(chatId: string, payload: NotificationPayload): Promise<boolean> {
    if (!this.enabled) {
      console.warn('[Telegram] Cannot send - service not enabled');
      return false;
    }

    const message = this.formatMessage(payload);

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.config.botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML',
            disable_web_page_preview: false,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error('[Telegram] Failed to send:', error);
        return false;
      }

      this.sentCount++;
      console.log(`[Telegram] Sent to ${chatId}: ${payload.title}`);
      return true;
    } catch (error) {
      console.error('[Telegram] Error sending:', error);
      return false;
    }
  }

  /**
   * Send notification to all registered chats
   */
  async sendToAll(payload: NotificationPayload): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const chatId of this.chatIds) {
      const result = await this.send(chatId, payload);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * Send a photo with caption
   */
  async sendPhoto(
    chatId: string,
    imageBase64: string,
    payload: NotificationPayload
  ): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    const caption = this.formatMessage(payload);

    try {
      // Convert base64 to buffer
      const imageBuffer = Buffer.from(
        imageBase64.replace(/^data:image\/[a-z]+;base64,/, ''),
        'base64'
      );

      // Create form data
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('caption', caption);
      formData.append('parse_mode', 'HTML');
      formData.append(
        'photo',
        new Blob([imageBuffer], { type: 'image/jpeg' }),
        'alert.jpg'
      );

      const response = await fetch(
        `https://api.telegram.org/bot${this.config.botToken}/sendPhoto`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error('[Telegram] Failed to send photo:', error);
        return false;
      }

      this.sentCount++;
      return true;
    } catch (error) {
      console.error('[Telegram] Error sending photo:', error);
      return false;
    }
  }

  // ===========================================================================
  // Message Formatting
  // ===========================================================================

  /**
   * Format a notification payload as a Telegram message
   */
  private formatMessage(payload: NotificationPayload): string {
    const severityEmoji: Record<AlertSeverity, string> = {
      info: 'ℹ️',
      warning: '⚠️',
      urgent: '🚨',
      critical: '🆘',
    };

    const severityLabel: Record<AlertSeverity, string> = {
      info: 'Info',
      warning: 'Warning',
      urgent: 'URGENT',
      critical: 'CRITICAL',
    };

    const emoji = severityEmoji[payload.severity] || '📢';
    const label = severityLabel[payload.severity] || 'Alert';

    let message = `${emoji} <b>SafeOS ${label}</b>\n\n`;
    message += `<b>${payload.title}</b>\n\n`;
    message += payload.body;

    if (payload.url) {
      message += `\n\n<a href="${payload.url}">View Alert</a>`;
    }

    return message;
  }

  // ===========================================================================
  // Bot Info
  // ===========================================================================

  /**
   * Get bot information
   */
  async getBotInfo(): Promise<{ username: string; id: number } | null> {
    if (!this.enabled) {
      return null;
    }

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.config.botToken}/getMe`
      );

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as {
        ok: boolean;
        result?: { id: number; username: string };
      };

      if (!data.ok || !data.result) {
        return null;
      }

      return {
        username: data.result.username,
        id: data.result.id,
      };
    } catch {
      return null;
    }
  }

  // ===========================================================================
  // Stats
  // ===========================================================================

  getSentCount(): number {
    return this.sentCount;
  }

  getRegisteredChatCount(): number {
    return this.chatIds.size;
  }
}

// =============================================================================
// Singleton
// =============================================================================

let defaultService: TelegramBotService | null = null;

export function getDefaultTelegramService(): TelegramBotService {
  if (!defaultService) {
    defaultService = new TelegramBotService();
  }
  return defaultService;
}


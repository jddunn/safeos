/**
 * Notification Routes
 *
 * API endpoints for notification configuration and management.
 *
 * @module api/routes/notifications
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getDefaultTelegramService } from '../../lib/alerts/telegram.js';
import { getDefaultTwilioService } from '../../lib/alerts/twilio.js';
import { getDefaultPushService } from '../../lib/alerts/browser-push.js';
import type { ApiResponse, AlertSeverity } from '../../types/index.js';

// =============================================================================
// Validation Schemas
// =============================================================================

const TelegramChatSchema = z.object({
  chatId: z.string().min(1),
});

const TwilioPhoneSchema = z.object({
  phoneNumber: z.string().min(10).max(15),
});

const PushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

const TestNotificationSchema = z.object({
  channel: z.enum(['telegram', 'twilio', 'push']),
  targetId: z.string().min(1), // chatId, phoneNumber, or subscriptionId
});

// =============================================================================
// Router
// =============================================================================

const router = Router();

// ===========================================================================
// GET /notifications/status - Get notification service status
// ===========================================================================

router.get('/status', async (_req: Request, res: Response) => {
  try {
    const telegram = getDefaultTelegramService();
    const twilio = getDefaultTwilioService();
    const push = getDefaultPushService();

    res.json({
      success: true,
      data: {
        telegram: {
          enabled: telegram.isEnabled(),
          chatCount: telegram.getRegisteredChatCount(),
          sentCount: telegram.getSentCount(),
        },
        twilio: {
          enabled: twilio.isEnabled(),
          phoneCount: twilio.getRegisteredPhoneCount(),
          sentCount: twilio.getSentCount(),
        },
        push: {
          enabled: push.isEnabled(),
          subscriptionCount: push.getSubscriptionCount(),
          sentCount: push.getSentCount(),
        },
      },
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

// ===========================================================================
// Telegram Routes
// ===========================================================================

router.get('/telegram/info', async (_req: Request, res: Response) => {
  try {
    const telegram = getDefaultTelegramService();

    if (!telegram.isEnabled()) {
      res.status(503).json({
        success: false,
        error: 'Telegram not configured',
      } as ApiResponse);
      return;
    }

    const botInfo = await telegram.getBotInfo();

    res.json({
      success: true,
      data: {
        enabled: true,
        bot: botInfo,
        chatCount: telegram.getRegisteredChatCount(),
      },
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

router.post('/telegram/register', async (req: Request, res: Response) => {
  try {
    const parseResult = TelegramChatSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid chat ID',
      } as ApiResponse);
      return;
    }

    const { chatId } = parseResult.data;
    const telegram = getDefaultTelegramService();

    telegram.registerChatId(chatId);

    res.json({
      success: true,
      message: 'Telegram chat registered',
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

router.delete('/telegram/:chatId', async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const telegram = getDefaultTelegramService();

    telegram.unregisterChatId(chatId);

    res.json({
      success: true,
      message: 'Telegram chat unregistered',
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

// ===========================================================================
// Twilio Routes
// ===========================================================================

router.post('/twilio/register', async (req: Request, res: Response) => {
  try {
    const parseResult = TwilioPhoneSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid phone number',
      } as ApiResponse);
      return;
    }

    const { phoneNumber } = parseResult.data;
    const twilio = getDefaultTwilioService();

    twilio.registerPhoneNumber(phoneNumber);

    res.json({
      success: true,
      message: 'Phone number registered',
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

router.delete('/twilio/:phoneNumber', async (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.params;
    const twilio = getDefaultTwilioService();

    twilio.unregisterPhoneNumber(phoneNumber);

    res.json({
      success: true,
      message: 'Phone number unregistered',
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

// ===========================================================================
// Push Notification Routes
// ===========================================================================

router.get('/push/vapid-key', async (_req: Request, res: Response) => {
  try {
    const push = getDefaultPushService();

    if (!push.isEnabled()) {
      res.status(503).json({
        success: false,
        error: 'Push notifications not configured',
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: {
        publicKey: push.getPublicKey(),
      },
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

router.post('/push/subscribe', async (req: Request, res: Response) => {
  try {
    const parseResult = PushSubscriptionSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid subscription',
      } as ApiResponse);
      return;
    }

    const push = getDefaultPushService();
    const subscriptionId = push.subscribe(parseResult.data);

    res.json({
      success: true,
      data: { subscriptionId },
      message: 'Push subscription registered',
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

router.delete('/push/:subscriptionId', async (req: Request, res: Response) => {
  try {
    const { subscriptionId } = req.params;
    const push = getDefaultPushService();

    push.unsubscribe(subscriptionId);

    res.json({
      success: true,
      message: 'Push subscription removed',
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

// ===========================================================================
// Test Notifications
// ===========================================================================

router.post('/test', async (req: Request, res: Response) => {
  try {
    const parseResult = TestNotificationSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid test request',
      } as ApiResponse);
      return;
    }

    const { channel, targetId } = parseResult.data;
    const payload = {
      title: 'SafeOS Test Notification',
      body: 'This is a test notification from SafeOS. If you received this, notifications are working correctly!',
      severity: 'info' as AlertSeverity,
      streamId: 'test-stream',
      alertId: 'test-alert',
      url: '/',
    };

    let result = false;

    switch (channel) {
      case 'telegram':
        const telegram = getDefaultTelegramService();
        result = await telegram.send(targetId, payload);
        break;

      case 'twilio':
        const twilio = getDefaultTwilioService();
        result = await twilio.send(targetId, payload);
        break;

      case 'push':
        const push = getDefaultPushService();
        result = await push.sendToSubscription(targetId, payload);
        break;
    }

    if (result) {
      res.json({
        success: true,
        message: `Test notification sent via ${channel}`,
      } as ApiResponse);
    } else {
      res.status(500).json({
        success: false,
        error: `Failed to send test notification via ${channel}`,
      } as ApiResponse);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

export default router;


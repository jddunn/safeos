/**
 * System Routes
 *
 * API endpoints for system health, Ollama status, and configuration.
 *
 * @module api/routes/system
 */

import { Router, type Request, type Response } from 'express';
import { getSafeOSDatabase, now } from '../../db/index.js';
import { getDefaultOllamaClient } from '../../lib/ollama/client.js';
import { getDefaultAnalysisQueue } from '../../queues/analysis-queue.js';
import { getDefaultEscalationManager } from '../../lib/alerts/escalation.js';
import { getDefaultContentFilter } from '../../lib/safety/content-filter.js';
import { getDefaultFrameAnalyzer } from '../../lib/analysis/frame-analyzer.js';
import { getDefaultTelegramService } from '../../lib/alerts/telegram.js';
import { getDefaultTwilioService } from '../../lib/alerts/twilio.js';
import { getDefaultPushService } from '../../lib/alerts/browser-push.js';
import { getDefaultSignalingServer } from '../../lib/webrtc/signaling.js';
import type { ApiResponse } from '../../types/index.js';

// =============================================================================
// Router
// =============================================================================

const router = Router();

// ===========================================================================
// GET /system/health - Health check
// ===========================================================================

router.get('/health', async (_req: Request, res: Response) => {
  try {
    const ollama = getDefaultOllamaClient();
    const db = await getSafeOSDatabase();

    // Check database
    let dbHealthy = false;
    try {
      await db.get('SELECT 1');
      dbHealthy = true;
    } catch {
      dbHealthy = false;
    }

    // Check Ollama
    const ollamaHealthy = await ollama.isHealthy();

    const healthy = dbHealthy; // Ollama is optional

    res.status(healthy ? 200 : 503).json({
      success: healthy,
      data: {
        status: healthy ? 'healthy' : 'degraded',
        database: dbHealthy,
        ollama: ollamaHealthy,
        timestamp: now(),
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
// GET /system/status - Detailed system status
// ===========================================================================

router.get('/status', async (_req: Request, res: Response) => {
  try {
    const db = await getSafeOSDatabase();
    const ollama = getDefaultOllamaClient();
    const queue = getDefaultAnalysisQueue();
    const escalation = getDefaultEscalationManager();
    const filter = getDefaultContentFilter();
    const analyzer = getDefaultFrameAnalyzer();
    const signaling = getDefaultSignalingServer();
    const telegram = getDefaultTelegramService();
    const twilio = getDefaultTwilioService();
    const push = getDefaultPushService();

    // Database counts
    const [streams, alerts, analyses, queue_stats] = await Promise.all([
      db.get<{ active: number; total: number }>(
        `SELECT 
           SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
           COUNT(*) as total
         FROM streams`
      ),
      db.get<{ unacknowledged: number; total: number }>(
        `SELECT 
           SUM(CASE WHEN acknowledged = 0 THEN 1 ELSE 0 END) as unacknowledged,
           COUNT(*) as total
         FROM alerts`
      ),
      db.get<{ count: number; avgMs: number }>(
        `SELECT COUNT(*) as count, AVG(inference_ms) as avgMs 
         FROM analysis_results 
         WHERE created_at > datetime("now", "-24 hours")`
      ),
      queue.getStats(),
    ]);

    // Ollama status
    let ollamaStatus = null;
    const ollamaHealthy = await ollama.isHealthy();
    if (ollamaHealthy) {
      const version = await ollama.getVersion();
      const models = await ollama.ensureModels();
      ollamaStatus = { version, ...models };
    }

    // WebRTC status
    const signalingStats = signaling.getStats();

    // Notification status
    const notifications = {
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
    };

    res.json({
      success: true,
      data: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        streams: {
          active: streams?.active || 0,
          total: streams?.total || 0,
        },
        alerts: {
          unacknowledged: alerts?.unacknowledged || 0,
          total: alerts?.total || 0,
          activeEscalations: escalation.getStats().activeCount,
        },
        analysis: {
          last24h: analyses?.count || 0,
          avgInferenceMs: Math.round(analyses?.avgMs || 0),
          queue: queue_stats,
          analyzerStats: analyzer.getStats(),
        },
        ollama: {
          healthy: ollamaHealthy,
          ...ollamaStatus,
        },
        webrtc: {
          peers: signalingStats.peerCount,
          rooms: signalingStats.roomCount,
        },
        moderation: filter.getStats(),
        notifications,
        timestamp: now(),
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
// GET /system/ollama - Ollama specific status
// ===========================================================================

router.get('/ollama', async (_req: Request, res: Response) => {
  try {
    const ollama = getDefaultOllamaClient();
    const healthy = await ollama.isHealthy();

    if (!healthy) {
      res.status(503).json({
        success: false,
        error: 'Ollama not available',
        data: { healthy: false },
      } as ApiResponse);
      return;
    }

    const version = await ollama.getVersion();
    const models = await ollama.listModels();
    const requiredModels = await ollama.ensureModels();

    res.json({
      success: true,
      data: {
        healthy: true,
        version,
        config: ollama.getConfig(),
        models: models.map((m) => ({
          name: m.name,
          size: m.size,
          modifiedAt: m.modifiedAt,
        })),
        required: requiredModels,
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
// POST /system/ollama/pull - Pull Ollama model
// ===========================================================================

router.post('/ollama/pull', async (req: Request, res: Response) => {
  try {
    const { model } = req.body as { model: string };

    if (!model) {
      res.status(400).json({
        success: false,
        error: 'Model name required',
      } as ApiResponse);
      return;
    }

    const ollama = getDefaultOllamaClient();

    // Start pull (this is synchronous but may take a while)
    res.status(202).json({
      success: true,
      message: `Starting download of ${model}...`,
    } as ApiResponse);

    // Pull in background
    void ollama.pullModel(model).then(() => {
      console.log(`[System] Model ${model} downloaded successfully`);
    }).catch((error) => {
      console.error(`[System] Failed to download ${model}:`, error);
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

// ===========================================================================
// GET /system/webrtc - WebRTC signaling status
// ===========================================================================

router.get('/webrtc', async (_req: Request, res: Response) => {
  try {
    const signaling = getDefaultSignalingServer();
    const stats = signaling.getStats();

    res.json({
      success: true,
      data: stats,
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

// ===========================================================================
// GET /system/config - Get current configuration
// ===========================================================================

router.get('/config', async (_req: Request, res: Response) => {
  try {
    const ollama = getDefaultOllamaClient();

    res.json({
      success: true,
      data: {
        bufferMinutes: parseInt(process.env['SAFEOS_BUFFER_MINUTES'] || '5', 10),
        port: parseInt(process.env['SAFEOS_PORT'] || '8474', 10),
        ollama: ollama.getConfig(),
        notifications: {
          telegram: !!process.env['TELEGRAM_BOT_TOKEN'],
          twilio: !!process.env['TWILIO_ACCOUNT_SID'],
          push: !!process.env['VAPID_PUBLIC_KEY'],
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
// GET /system/disclaimers - Get legal disclaimers
// ===========================================================================

router.get('/disclaimers', async (_req: Request, res: Response) => {
  try {
    const { CRITICAL_DISCLAIMER } = await import('../../lib/safety/disclaimers.js');

    res.json({
      success: true,
      data: {
        critical: CRITICAL_DISCLAIMER,
        mustAccept: true,
      },
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

export default router;


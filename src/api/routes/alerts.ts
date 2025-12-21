/**
 * Alert Routes
 *
 * API endpoints for alert management and escalation.
 *
 * @module api/routes/alerts
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getSafeOSDatabase, generateId, now } from '../../db/index.js';
import { getDefaultEscalationManager } from '../../lib/alerts/escalation.js';
import { getDefaultTelegramService } from '../../lib/alerts/telegram.js';
import { getDefaultTwilioService } from '../../lib/alerts/twilio.js';
import { getDefaultPushService } from '../../lib/alerts/browser-push.js';
import type { ApiResponse, Alert, AlertSeverity, NotificationPayload } from '../../types/index.js';

// =============================================================================
// Validation Schemas
// =============================================================================

const CreateAlertSchema = z.object({
  streamId: z.string().uuid(),
  alertType: z.enum(['motion', 'audio', 'concern', 'system']),
  severity: z.enum(['info', 'warning', 'urgent', 'critical']),
  message: z.string().min(1).max(1000),
  analysisId: z.string().uuid().optional(),
});

// =============================================================================
// Router
// =============================================================================

const router = Router();

// ===========================================================================
// GET /alerts - List alerts
// ===========================================================================

router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      streamId,
      acknowledged,
      severity,
      limit = '50',
      offset = '0',
    } = req.query;

    const db = await getSafeOSDatabase();

    let query = 'SELECT * FROM alerts';
    const params: (string | number)[] = [];
    const conditions: string[] = [];

    if (streamId) {
      conditions.push('stream_id = ?');
      params.push(String(streamId));
    }

    if (acknowledged !== undefined) {
      conditions.push('acknowledged = ?');
      params.push(acknowledged === 'true' ? 1 : 0);
    }

    if (severity) {
      conditions.push('severity = ?');
      params.push(String(severity));
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(String(limit), 10));
    params.push(parseInt(String(offset), 10));

    const alerts = await db.all(query, params);

    // Get total count
    const countQuery = conditions.length > 0
      ? `SELECT COUNT(*) as total FROM alerts WHERE ${conditions.join(' AND ')}`
      : 'SELECT COUNT(*) as total FROM alerts';
    const countParams = conditions.length > 0 ? params.slice(0, -2) : [];
    const countResult = await db.get<{ total: number }>(countQuery, countParams);

    res.json({
      success: true,
      data: alerts,
      total: countResult?.total || 0,
      hasMore: (countResult?.total || 0) > parseInt(String(offset), 10) + alerts.length,
    } as ApiResponse & { total: number; hasMore: boolean });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

// ===========================================================================
// GET /alerts/active - Get active (unacknowledged) alerts
// ===========================================================================

router.get('/active', async (req: Request, res: Response) => {
  try {
    const db = await getSafeOSDatabase();
    const escalation = getDefaultEscalationManager();

    const alerts = await db.all(
      `SELECT * FROM alerts 
       WHERE acknowledged = 0 
       ORDER BY 
         CASE severity 
           WHEN 'critical' THEN 0 
           WHEN 'urgent' THEN 1 
           WHEN 'warning' THEN 2 
           WHEN 'info' THEN 3 
         END, 
         created_at DESC`
    );

    // Add escalation info
    const alertsWithEscalation = alerts.map((alert: Alert) => ({
      ...alert,
      escalation: {
        currentLevel: escalation.getAlertLevel(alert.id),
        currentVolume: escalation.getVolume(alert.id),
        currentSound: escalation.getSound(alert.id),
      },
    }));

    res.json({
      success: true,
      data: alertsWithEscalation,
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

// ===========================================================================
// GET /alerts/:id - Get alert by ID
// ===========================================================================

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getSafeOSDatabase();
    const escalation = getDefaultEscalationManager();

    const alert = await db.get<Alert>('SELECT * FROM alerts WHERE id = ?', [id]);

    if (!alert) {
      res.status(404).json({
        success: false,
        error: 'Alert not found',
      } as ApiResponse);
      return;
    }

    // Get associated analysis if any
    let analysis = null;
    if (alert.analysisId) {
      analysis = await db.get(
        'SELECT * FROM analysis_results WHERE id = ?',
        [alert.analysisId]
      );
    }

    res.json({
      success: true,
      data: {
        ...alert,
        analysis,
        escalation: {
          currentLevel: escalation.getAlertLevel(alert.id),
          currentVolume: escalation.getVolume(alert.id),
          currentSound: escalation.getSound(alert.id),
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
// POST /alerts - Create alert
// ===========================================================================

router.post('/', async (req: Request, res: Response) => {
  try {
    const parseResult = CreateAlertSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: parseResult.error.errors.map((e) => e.message).join(', '),
      } as ApiResponse);
      return;
    }

    const { streamId, alertType, severity, message, analysisId } = parseResult.data;
    const db = await getSafeOSDatabase();

    const id = generateId();
    const timestamp = now();

    await db.run(
      `INSERT INTO alerts 
       (id, stream_id, analysis_id, alert_type, severity, message, escalation_level, acknowledged, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?)`,
      [id, streamId, analysisId || null, alertType, severity, message, timestamp]
    );

    const alert = await db.get<Alert>('SELECT * FROM alerts WHERE id = ?', [id]);

    if (alert) {
      // Start escalation tracking
      const escalation = getDefaultEscalationManager();
      escalation.startAlert(alert);

      // Send immediate notifications for urgent/critical
      if (severity === 'urgent' || severity === 'critical') {
        void sendNotifications(alert);
      }
    }

    res.status(201).json({
      success: true,
      data: alert,
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

// ===========================================================================
// POST /alerts/:id/acknowledge - Acknowledge alert
// ===========================================================================

router.post('/:id/acknowledge', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getSafeOSDatabase();
    const escalation = getDefaultEscalationManager();

    const alert = await db.get('SELECT * FROM alerts WHERE id = ?', [id]);

    if (!alert) {
      res.status(404).json({
        success: false,
        error: 'Alert not found',
      } as ApiResponse);
      return;
    }

    // Update database
    await db.run(
      'UPDATE alerts SET acknowledged = 1, acknowledged_at = ? WHERE id = ?',
      [now(), id]
    );

    // Stop escalation
    escalation.acknowledgeAlert(id);

    res.json({
      success: true,
      message: 'Alert acknowledged',
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

// ===========================================================================
// POST /alerts/acknowledge-all - Acknowledge all alerts
// ===========================================================================

router.post('/acknowledge-all', async (req: Request, res: Response) => {
  try {
    const { streamId } = req.body as { streamId?: string };
    const db = await getSafeOSDatabase();
    const escalation = getDefaultEscalationManager();

    let query = 'UPDATE alerts SET acknowledged = 1, acknowledged_at = ? WHERE acknowledged = 0';
    const params: string[] = [now()];

    if (streamId) {
      query += ' AND stream_id = ?';
      params.push(streamId);
    }

    const result = await db.run(query, params);

    // Clear all escalation tracking
    escalation.clearAll();

    res.json({
      success: true,
      message: `Acknowledged ${result.changes || 0} alerts`,
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

// ===========================================================================
// GET /alerts/stats - Get alert statistics
// ===========================================================================

router.get('/stats/summary', async (req: Request, res: Response) => {
  try {
    const { period = '24h' } = req.query;
    const db = await getSafeOSDatabase();

    // Parse period
    let periodSql: string;
    switch (period) {
      case '1h':
        periodSql = '-1 hour';
        break;
      case '24h':
        periodSql = '-24 hours';
        break;
      case '7d':
        periodSql = '-7 days';
        break;
      case '30d':
        periodSql = '-30 days';
        break;
      default:
        periodSql = '-24 hours';
    }

    const [total, unacknowledged, bySeverity, byType, avgResponseTime] = await Promise.all([
      db.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM alerts WHERE created_at > datetime("now", ?)`,
        [periodSql]
      ),
      db.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM alerts 
         WHERE acknowledged = 0 AND created_at > datetime("now", ?)`,
        [periodSql]
      ),
      db.all<{ severity: string; count: number }>(
        `SELECT severity, COUNT(*) as count FROM alerts 
         WHERE created_at > datetime("now", ?)
         GROUP BY severity`,
        [periodSql]
      ),
      db.all<{ alert_type: string; count: number }>(
        `SELECT alert_type, COUNT(*) as count FROM alerts 
         WHERE created_at > datetime("now", ?)
         GROUP BY alert_type`,
        [periodSql]
      ),
      db.get<{ avgMs: number }>(
        `SELECT AVG(
           (julianday(acknowledged_at) - julianday(created_at)) * 86400000
         ) as avgMs 
         FROM alerts 
         WHERE acknowledged = 1 
         AND acknowledged_at IS NOT NULL
         AND created_at > datetime("now", ?)`,
        [periodSql]
      ),
    ]);

    const severityBreakdown: Record<string, number> = {};
    for (const row of bySeverity) {
      severityBreakdown[row.severity] = row.count;
    }

    const typeBreakdown: Record<string, number> = {};
    for (const row of byType) {
      typeBreakdown[row.alert_type] = row.count;
    }

    res.json({
      success: true,
      data: {
        period,
        totalAlerts: total?.count || 0,
        unacknowledgedAlerts: unacknowledged?.count || 0,
        bySeverity: severityBreakdown,
        byType: typeBreakdown,
        avgResponseTimeMs: Math.round(avgResponseTime?.avgMs || 0),
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
// Helper Functions
// ===========================================================================

async function sendNotifications(alert: Alert): Promise<void> {
  const payload: NotificationPayload = {
    title: `SafeOS ${alert.severity.toUpperCase()} Alert`,
    body: alert.message,
    severity: alert.severity as AlertSeverity,
    streamId: alert.streamId,
    alertId: alert.id,
    url: `/alerts/${alert.id}`,
  };

  // Send via all configured channels
  const [telegram, twilio, push] = [
    getDefaultTelegramService(),
    getDefaultTwilioService(),
    getDefaultPushService(),
  ];

  const promises: Promise<unknown>[] = [];

  if (telegram.isEnabled()) {
    promises.push(telegram.sendToAll(payload));
  }

  if (twilio.isEnabled()) {
    promises.push(twilio.sendToAll(payload));
  }

  if (push.isEnabled()) {
    promises.push(push.sendToAll(payload));
  }

  try {
    await Promise.allSettled(promises);
  } catch (error) {
    console.error('[Alerts] Failed to send notifications:', error);
  }
}

export default router;


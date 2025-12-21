/**
 * Analysis Routes
 *
 * API endpoints for analysis queue and results.
 *
 * @module api/routes/analysis
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getSafeOSDatabase, generateId, now } from '../../db/index.js';
import { getDefaultAnalysisQueue } from '../../queues/analysis-queue.js';
import { getDefaultFrameAnalyzer } from '../../lib/analysis/frame-analyzer.js';
import type { ApiResponse, MonitoringScenario } from '../../types/index.js';

// =============================================================================
// Validation Schemas
// =============================================================================

const QueueAnalysisSchema = z.object({
  streamId: z.string().uuid(),
  frameData: z.string().min(100), // Base64 image
  scenario: z.enum(['pet', 'baby', 'elderly']),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
});

const AnalyzeNowSchema = z.object({
  frameData: z.string().min(100),
  scenario: z.enum(['pet', 'baby', 'elderly']),
  streamId: z.string().uuid().optional(),
});

// =============================================================================
// Router
// =============================================================================

const router = Router();

// ===========================================================================
// GET /analysis/queue - Get queue status
// ===========================================================================

router.get('/queue', async (_req: Request, res: Response) => {
  try {
    const queue = getDefaultAnalysisQueue();
    const stats = await queue.getStats();

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
// GET /analysis/queue/jobs - Get queued jobs
// ===========================================================================

router.get('/queue/jobs', async (req: Request, res: Response) => {
  try {
    const { status = 'pending', limit = '20' } = req.query;
    const db = await getSafeOSDatabase();

    const jobs = await db.all(
      `SELECT id, stream_id, scenario, priority, status, attempts, created_at, started_at, completed_at, error
       FROM analysis_queue 
       WHERE status = ?
       ORDER BY 
         CASE priority 
           WHEN 'urgent' THEN 0 
           WHEN 'high' THEN 1 
           WHEN 'normal' THEN 2 
           WHEN 'low' THEN 3 
         END,
         created_at ASC
       LIMIT ?`,
      [String(status), parseInt(String(limit), 10)]
    );

    res.json({
      success: true,
      data: jobs,
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

// ===========================================================================
// POST /analysis/queue - Add job to queue
// ===========================================================================

router.post('/queue', async (req: Request, res: Response) => {
  try {
    const parseResult = QueueAnalysisSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: parseResult.error.errors.map((e) => e.message).join(', '),
      } as ApiResponse);
      return;
    }

    const { streamId, frameData, scenario, priority } = parseResult.data;
    const queue = getDefaultAnalysisQueue();

    const jobId = await queue.enqueue({
      streamId,
      frameData,
      scenario,
      priority,
    });

    res.status(202).json({
      success: true,
      data: { jobId },
      message: 'Analysis job queued',
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

// ===========================================================================
// POST /analysis/now - Analyze immediately (synchronous)
// ===========================================================================

router.post('/now', async (req: Request, res: Response) => {
  try {
    const parseResult = AnalyzeNowSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: parseResult.error.errors.map((e) => e.message).join(', '),
      } as ApiResponse);
      return;
    }

    const { frameData, scenario, streamId } = parseResult.data;
    const analyzer = getDefaultFrameAnalyzer();

    const result = await analyzer.analyze({
      frameData,
      scenario,
      streamId: streamId || generateId(),
    });

    res.json({
      success: true,
      data: result,
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

// ===========================================================================
// GET /analysis/results - Get analysis results
// ===========================================================================

router.get('/results', async (req: Request, res: Response) => {
  try {
    const {
      streamId,
      concernLevel,
      limit = '50',
      offset = '0',
    } = req.query;

    const db = await getSafeOSDatabase();

    let query = 'SELECT * FROM analysis_results';
    const params: (string | number)[] = [];
    const conditions: string[] = [];

    if (streamId) {
      conditions.push('stream_id = ?');
      params.push(String(streamId));
    }

    if (concernLevel) {
      conditions.push('concern_level = ?');
      params.push(String(concernLevel));
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(String(limit), 10));
    params.push(parseInt(String(offset), 10));

    const results = await db.all(query, params);

    // Get total count
    const countQuery = conditions.length > 0
      ? `SELECT COUNT(*) as total FROM analysis_results WHERE ${conditions.join(' AND ')}`
      : 'SELECT COUNT(*) as total FROM analysis_results';
    const countParams = conditions.length > 0 ? params.slice(0, -2) : [];
    const countResult = await db.get<{ total: number }>(countQuery, countParams);

    res.json({
      success: true,
      data: results,
      total: countResult?.total || 0,
      hasMore: (countResult?.total || 0) > parseInt(String(offset), 10) + results.length,
    } as ApiResponse & { total: number; hasMore: boolean });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

// ===========================================================================
// GET /analysis/results/:id - Get specific result
// ===========================================================================

router.get('/results/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getSafeOSDatabase();

    const result = await db.get('SELECT * FROM analysis_results WHERE id = ?', [id]);

    if (!result) {
      res.status(404).json({
        success: false,
        error: 'Analysis result not found',
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: result,
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

// ===========================================================================
// GET /analysis/stats - Get analysis statistics
// ===========================================================================

router.get('/stats', async (req: Request, res: Response) => {
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
      default:
        periodSql = '-24 hours';
    }

    const [total, byScenario, byConcern, performance, cloudFallback] = await Promise.all([
      db.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM analysis_results WHERE created_at > datetime("now", ?)`,
        [periodSql]
      ),
      db.all<{ scenario: string; count: number }>(
        `SELECT scenario, COUNT(*) as count FROM analysis_results 
         WHERE created_at > datetime("now", ?)
         GROUP BY scenario`,
        [periodSql]
      ),
      db.all<{ concern_level: string; count: number }>(
        `SELECT concern_level, COUNT(*) as count FROM analysis_results 
         WHERE created_at > datetime("now", ?)
         GROUP BY concern_level`,
        [periodSql]
      ),
      db.get<{ avgMs: number; minMs: number; maxMs: number }>(
        `SELECT 
           AVG(inference_ms) as avgMs,
           MIN(inference_ms) as minMs,
           MAX(inference_ms) as maxMs
         FROM analysis_results 
         WHERE created_at > datetime("now", ?)`,
        [periodSql]
      ),
      db.get<{ local: number; cloud: number }>(
        `SELECT 
           SUM(CASE WHEN model_used NOT LIKE '%cloud%' THEN 1 ELSE 0 END) as local,
           SUM(CASE WHEN model_used LIKE '%cloud%' THEN 1 ELSE 0 END) as cloud
         FROM analysis_results 
         WHERE created_at > datetime("now", ?)`,
        [periodSql]
      ),
    ]);

    const scenarioBreakdown: Record<string, number> = {};
    for (const row of byScenario) {
      scenarioBreakdown[row.scenario] = row.count;
    }

    const concernBreakdown: Record<string, number> = {};
    for (const row of byConcern) {
      concernBreakdown[row.concern_level] = row.count;
    }

    res.json({
      success: true,
      data: {
        period,
        totalAnalyses: total?.count || 0,
        byScenario: scenarioBreakdown,
        byConcernLevel: concernBreakdown,
        performance: {
          avgMs: Math.round(performance?.avgMs || 0),
          minMs: performance?.minMs || 0,
          maxMs: performance?.maxMs || 0,
        },
        modelUsage: {
          local: cloudFallback?.local || 0,
          cloud: cloudFallback?.cloud || 0,
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
// POST /analysis/queue/start - Start queue processing
// ===========================================================================

router.post('/queue/start', async (_req: Request, res: Response) => {
  try {
    const queue = getDefaultAnalysisQueue();
    queue.start();

    res.json({
      success: true,
      message: 'Queue processing started',
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

// ===========================================================================
// POST /analysis/queue/stop - Stop queue processing
// ===========================================================================

router.post('/queue/stop', async (_req: Request, res: Response) => {
  try {
    const queue = getDefaultAnalysisQueue();
    queue.stop();

    res.json({
      success: true,
      message: 'Queue processing stopped',
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

export default router;


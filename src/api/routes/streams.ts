/**
 * Stream Routes
 *
 * API endpoints for stream management.
 *
 * @module api/routes/streams
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getSafeOSDatabase, generateId, now } from '../../db/index.js';
import type { ApiResponse, Stream } from '../../types/index.js';

// =============================================================================
// Validation Schemas
// =============================================================================

const CreateStreamSchema = z.object({
  name: z.string().min(1).max(100),
  profileId: z.string().uuid(),
  metadata: z.record(z.unknown()).optional(),
});

const UpdateStreamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  status: z.enum(['active', 'paused', 'disconnected']).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// =============================================================================
// Router
// =============================================================================

const router = Router();

// ===========================================================================
// GET /streams - List all streams
// ===========================================================================

router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, limit = '50', offset = '0' } = req.query;
    const db = await getSafeOSDatabase();

    let query = 'SELECT * FROM streams';
    const params: (string | number)[] = [];
    const conditions: string[] = [];

    if (status) {
      conditions.push('status = ?');
      params.push(String(status));
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(String(limit), 10));
    params.push(parseInt(String(offset), 10));

    const streams = await db.all(query, params);

    // Get total count
    const countQuery = conditions.length > 0
      ? `SELECT COUNT(*) as total FROM streams WHERE ${conditions.join(' AND ')}`
      : 'SELECT COUNT(*) as total FROM streams';
    const countParams = conditions.length > 0 ? params.slice(0, -2) : [];
    const countResult = await db.get<{ total: number }>(countQuery, countParams);

    const response: ApiResponse<Stream[]> & { total: number; hasMore: boolean } = {
      success: true,
      data: streams as Stream[],
      total: countResult?.total || 0,
      hasMore: (countResult?.total || 0) > parseInt(String(offset), 10) + streams.length,
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

// ===========================================================================
// GET /streams/:id - Get stream by ID
// ===========================================================================

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getSafeOSDatabase();

    const stream = await db.get('SELECT * FROM streams WHERE id = ?', [id]);

    if (!stream) {
      res.status(404).json({
        success: false,
        error: 'Stream not found',
      } as ApiResponse);
      return;
    }

    // Get recent stats
    const [alertCount, analysisCount, frameCount] = await Promise.all([
      db.get<{ count: number }>(
        'SELECT COUNT(*) as count FROM alerts WHERE stream_id = ? AND created_at > datetime("now", "-1 hour")',
        [id]
      ),
      db.get<{ count: number }>(
        'SELECT COUNT(*) as count FROM analysis_results WHERE stream_id = ? AND created_at > datetime("now", "-1 hour")',
        [id]
      ),
      db.get<{ count: number }>(
        'SELECT COUNT(*) as count FROM frame_buffer WHERE stream_id = ?',
        [id]
      ),
    ]);

    const response: ApiResponse = {
      success: true,
      data: {
        ...stream,
        stats: {
          recentAlerts: alertCount?.count || 0,
          recentAnalyses: analysisCount?.count || 0,
          bufferedFrames: frameCount?.count || 0,
        },
      },
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

// ===========================================================================
// POST /streams - Create new stream
// ===========================================================================

router.post('/', async (req: Request, res: Response) => {
  try {
    const parseResult = CreateStreamSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: parseResult.error.errors.map((e) => e.message).join(', '),
      } as ApiResponse);
      return;
    }

    const { name, profileId, metadata } = parseResult.data;
    const db = await getSafeOSDatabase();

    // Verify profile exists
    const profile = await db.get('SELECT id FROM monitoring_profiles WHERE id = ?', [profileId]);
    if (!profile) {
      res.status(400).json({
        success: false,
        error: 'Profile not found',
      } as ApiResponse);
      return;
    }

    const id = generateId();
    const timestamp = now();

    await db.run(
      `INSERT INTO streams (id, name, profile_id, status, created_at, metadata)
       VALUES (?, ?, ?, 'active', ?, ?)`,
      [id, name, profileId, timestamp, metadata ? JSON.stringify(metadata) : null]
    );

    const stream = await db.get('SELECT * FROM streams WHERE id = ?', [id]);

    res.status(201).json({
      success: true,
      data: stream,
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

// ===========================================================================
// PUT /streams/:id - Update stream
// ===========================================================================

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parseResult = UpdateStreamSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: parseResult.error.errors.map((e) => e.message).join(', '),
      } as ApiResponse);
      return;
    }

    const db = await getSafeOSDatabase();

    // Check if stream exists
    const existing = await db.get('SELECT * FROM streams WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({
        success: false,
        error: 'Stream not found',
      } as ApiResponse);
      return;
    }

    const { name, status, metadata } = parseResult.data;
    const updates: string[] = [];
    const params: (string | null)[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }

    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }

    if (metadata !== undefined) {
      updates.push('metadata = ?');
      params.push(JSON.stringify(metadata));
    }

    if (updates.length > 0) {
      params.push(id);
      await db.run(`UPDATE streams SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const stream = await db.get('SELECT * FROM streams WHERE id = ?', [id]);

    res.json({
      success: true,
      data: stream,
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

// ===========================================================================
// DELETE /streams/:id - Delete/disconnect stream
// ===========================================================================

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query;
    const db = await getSafeOSDatabase();

    // Check if stream exists
    const existing = await db.get('SELECT * FROM streams WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({
        success: false,
        error: 'Stream not found',
      } as ApiResponse);
      return;
    }

    if (permanent === 'true') {
      // Permanent deletion - cascade to related tables
      await db.run('DELETE FROM frame_buffer WHERE stream_id = ?', [id]);
      await db.run('DELETE FROM analysis_results WHERE stream_id = ?', [id]);
      await db.run('DELETE FROM alerts WHERE stream_id = ?', [id]);
      await db.run('DELETE FROM content_flags WHERE stream_id = ?', [id]);
      await db.run('DELETE FROM analysis_queue WHERE stream_id = ?', [id]);
      await db.run('DELETE FROM streams WHERE id = ?', [id]);

      res.json({
        success: true,
        message: 'Stream permanently deleted',
      } as ApiResponse);
    } else {
      // Soft delete - just mark as disconnected
      await db.run('UPDATE streams SET status = ? WHERE id = ?', ['disconnected', id]);

      res.json({
        success: true,
        message: 'Stream disconnected',
      } as ApiResponse);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

// ===========================================================================
// POST /streams/:id/pause - Pause stream
// ===========================================================================

router.post('/:id/pause', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getSafeOSDatabase();

    const result = await db.run(
      'UPDATE streams SET status = ? WHERE id = ? AND status = ?',
      ['paused', id, 'active']
    );

    if (!result.changes || result.changes === 0) {
      res.status(400).json({
        success: false,
        error: 'Stream not found or not active',
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      message: 'Stream paused',
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

// ===========================================================================
// POST /streams/:id/resume - Resume stream
// ===========================================================================

router.post('/:id/resume', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getSafeOSDatabase();

    const result = await db.run(
      'UPDATE streams SET status = ? WHERE id = ? AND status = ?',
      ['active', id, 'paused']
    );

    if (!result.changes || result.changes === 0) {
      res.status(400).json({
        success: false,
        error: 'Stream not found or not paused',
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      message: 'Stream resumed',
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

// ===========================================================================
// GET /streams/:id/stats - Get stream statistics
// ===========================================================================

router.get('/:id/stats', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { period = '1h' } = req.query;
    const db = await getSafeOSDatabase();

    // Parse period
    let periodSql: string;
    switch (period) {
      case '15m':
        periodSql = '-15 minutes';
        break;
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
        periodSql = '-1 hour';
    }

    const [alerts, analyses, frames, concerns] = await Promise.all([
      db.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM alerts 
         WHERE stream_id = ? AND created_at > datetime("now", ?)`,
        [id, periodSql]
      ),
      db.get<{ count: number; avgMs: number }>(
        `SELECT COUNT(*) as count, AVG(inference_ms) as avgMs FROM analysis_results 
         WHERE stream_id = ? AND created_at > datetime("now", ?)`,
        [id, periodSql]
      ),
      db.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM frame_buffer WHERE stream_id = ?`,
        [id]
      ),
      db.all<{ concern_level: string; count: number }>(
        `SELECT concern_level, COUNT(*) as count FROM analysis_results 
         WHERE stream_id = ? AND created_at > datetime("now", ?)
         GROUP BY concern_level`,
        [id, periodSql]
      ),
    ]);

    const concernBreakdown: Record<string, number> = {};
    for (const row of concerns) {
      concernBreakdown[row.concern_level] = row.count;
    }

    res.json({
      success: true,
      data: {
        period,
        alertCount: alerts?.count || 0,
        analysisCount: analyses?.count || 0,
        avgInferenceMs: Math.round(analyses?.avgMs || 0),
        bufferedFrames: frames?.count || 0,
        concernBreakdown,
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


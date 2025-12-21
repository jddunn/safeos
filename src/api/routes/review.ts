/**
 * Human Review Routes
 *
 * API endpoints for content moderation and human review queue.
 *
 * @module api/routes/review
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getSafeOSDatabase, generateId, now } from '../../db/index.js';
import type { ApiResponse, ContentFlag, ModerationTier } from '../../types/index.js';

// =============================================================================
// Validation Schemas
// =============================================================================

const ReviewDecisionSchema = z.object({
  decision: z.enum(['dismiss', 'escalate', 'ban']),
  notes: z.string().max(1000).optional(),
});

// =============================================================================
// Router
// =============================================================================

const router = Router();

// ===========================================================================
// GET /review/queue - Get pending review items
// ===========================================================================

router.get('/queue', async (req: Request, res: Response) => {
  try {
    const { tier, limit = '20' } = req.query;
    const db = await getSafeOSDatabase();

    let query = `
      SELECT * FROM content_flags 
      WHERE status = 'pending'
    `;
    const params: (string | number)[] = [];

    if (tier) {
      query += ' AND tier = ?';
      params.push(parseInt(String(tier), 10));
    }

    query += ' ORDER BY tier DESC, created_at ASC LIMIT ?';
    params.push(parseInt(String(limit), 10));

    const flags = await db.all(query, params);

    // Anonymize data for review
    const anonymizedFlags = flags.map((flag: ContentFlag) => ({
      id: flag.id,
      tier: flag.tier,
      categories: flag.categories,
      createdAt: flag.createdAt,
      // Don't include streamId or frameId in response
      // Frame data should be fetched separately with blur applied
    }));

    res.json({
      success: true,
      data: anonymizedFlags,
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

// ===========================================================================
// GET /review/queue/stats - Get review queue statistics
// ===========================================================================

router.get('/queue/stats', async (_req: Request, res: Response) => {
  try {
    const db = await getSafeOSDatabase();

    const [pending, byTier, byStatus, avgReviewTime] = await Promise.all([
      db.get<{ count: number }>(
        'SELECT COUNT(*) as count FROM content_flags WHERE status = ?',
        ['pending']
      ),
      db.all<{ tier: number; count: number }>(
        `SELECT tier, COUNT(*) as count FROM content_flags 
         WHERE status = 'pending' 
         GROUP BY tier`
      ),
      db.all<{ status: string; count: number }>(
        'SELECT status, COUNT(*) as count FROM content_flags GROUP BY status'
      ),
      db.get<{ avgMs: number }>(
        `SELECT AVG(
           (julianday(reviewed_at) - julianday(created_at)) * 86400000
         ) as avgMs 
         FROM content_flags 
         WHERE reviewed_at IS NOT NULL`
      ),
    ]);

    const tierBreakdown: Record<number, number> = {};
    for (const row of byTier) {
      tierBreakdown[row.tier] = row.count;
    }

    const statusBreakdown: Record<string, number> = {};
    for (const row of byStatus) {
      statusBreakdown[row.status] = row.count;
    }

    res.json({
      success: true,
      data: {
        pendingCount: pending?.count || 0,
        byTier: tierBreakdown,
        byStatus: statusBreakdown,
        avgReviewTimeMs: Math.round(avgReviewTime?.avgMs || 0),
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
// GET /review/:id - Get review item (with anonymized frame)
// ===========================================================================

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getSafeOSDatabase();

    const flag = await db.get<ContentFlag>(
      'SELECT * FROM content_flags WHERE id = ?',
      [id]
    );

    if (!flag) {
      res.status(404).json({
        success: false,
        error: 'Review item not found',
      } as ApiResponse);
      return;
    }

    // Get frame data with blur applied for tier 3+
    let frameData = null;
    if (flag.frameId) {
      const frame = await db.get<{ frame_data: string }>(
        'SELECT frame_data FROM frame_buffer WHERE id = ?',
        [flag.frameId]
      );

      if (frame) {
        // In production, apply blur/anonymization here
        // For now, just indicate it exists
        frameData = {
          available: true,
          blurred: flag.tier >= 3,
        };
      }
    }

    res.json({
      success: true,
      data: {
        id: flag.id,
        tier: flag.tier,
        categories: flag.categories,
        status: flag.status,
        createdAt: flag.createdAt,
        frame: frameData,
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
// POST /review/:id/decision - Submit review decision
// ===========================================================================

router.post('/:id/decision', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parseResult = ReviewDecisionSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid decision',
      } as ApiResponse);
      return;
    }

    const { decision, notes } = parseResult.data;
    const db = await getSafeOSDatabase();

    // Check if flag exists
    const flag = await db.get<ContentFlag>(
      'SELECT * FROM content_flags WHERE id = ?',
      [id]
    );

    if (!flag) {
      res.status(404).json({
        success: false,
        error: 'Review item not found',
      } as ApiResponse);
      return;
    }

    // Update flag status
    let status: string;
    switch (decision) {
      case 'dismiss':
        status = 'dismissed';
        break;
      case 'escalate':
        status = 'escalated';
        break;
      case 'ban':
        status = 'banned';
        break;
      default:
        status = 'reviewed';
    }

    await db.run(
      `UPDATE content_flags 
       SET status = ?, reviewed_by = ?, reviewed_at = ?, notes = ?
       WHERE id = ?`,
      [status, 'human-reviewer', now(), notes || null, id]
    );

    // If banned, could take additional actions here
    // (e.g., disable stream, notify user, log for compliance)

    res.json({
      success: true,
      message: `Review item ${decision === 'dismiss' ? 'dismissed' : decision === 'escalate' ? 'escalated' : 'banned'}`,
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

// ===========================================================================
// GET /review/history - Get reviewed items
// ===========================================================================

router.get('/history/list', async (req: Request, res: Response) => {
  try {
    const { status, limit = '50', offset = '0' } = req.query;
    const db = await getSafeOSDatabase();

    let query = "SELECT * FROM content_flags WHERE status != 'pending'";
    const params: (string | number)[] = [];

    if (status) {
      query = 'SELECT * FROM content_flags WHERE status = ?';
      params.push(String(status));
    }

    query += ' ORDER BY reviewed_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(String(limit), 10));
    params.push(parseInt(String(offset), 10));

    const flags = await db.all(query, params);

    res.json({
      success: true,
      data: flags,
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

// ===========================================================================
// POST /review/batch - Batch review decisions
// ===========================================================================

router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { decisions } = req.body as {
      decisions: Array<{ id: string; decision: 'dismiss' | 'escalate' | 'ban' }>;
    };

    if (!Array.isArray(decisions) || decisions.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Invalid batch decisions',
      } as ApiResponse);
      return;
    }

    const db = await getSafeOSDatabase();
    const timestamp = now();
    let processed = 0;

    for (const { id, decision } of decisions) {
      let status: string;
      switch (decision) {
        case 'dismiss':
          status = 'dismissed';
          break;
        case 'escalate':
          status = 'escalated';
          break;
        case 'ban':
          status = 'banned';
          break;
        default:
          continue;
      }

      const result = await db.run(
        `UPDATE content_flags 
         SET status = ?, reviewed_by = ?, reviewed_at = ?
         WHERE id = ? AND status = 'pending'`,
        [status, 'human-reviewer-batch', timestamp, id]
      );

      if (result.changes && result.changes > 0) {
        processed++;
      }
    }

    res.json({
      success: true,
      message: `Processed ${processed} of ${decisions.length} items`,
      data: { processed, total: decisions.length },
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

export default router;


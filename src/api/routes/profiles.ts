/**
 * Profile Routes
 *
 * API endpoints for monitoring profile management.
 *
 * @module api/routes/profiles
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getSafeOSDatabase, generateId, now } from '../../db/index.js';
import type { ApiResponse, MonitoringProfile } from '../../types/index.js';

// =============================================================================
// Validation Schemas
// =============================================================================

const CreateProfileSchema = z.object({
  name: z.string().min(1).max(100),
  scenario: z.enum(['pet', 'baby', 'elderly']),
  motionThreshold: z.number().min(0).max(1).optional().default(0.15),
  audioThreshold: z.number().min(0).max(1).optional().default(0.2),
  alertSpeed: z.enum(['slow', 'normal', 'fast', 'immediate']).optional().default('normal'),
  description: z.string().max(500).optional(),
  customPrompt: z.string().max(2000).optional(),
});

const UpdateProfileSchema = CreateProfileSchema.partial();

// =============================================================================
// Router
// =============================================================================

const router = Router();

// ===========================================================================
// GET /profiles - List all profiles
// ===========================================================================

router.get('/', async (_req: Request, res: Response) => {
  try {
    const db = await getSafeOSDatabase();
    const profiles = await db.all('SELECT * FROM monitoring_profiles ORDER BY scenario, name');

    res.json({
      success: true,
      data: profiles,
    } as ApiResponse<MonitoringProfile[]>);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

// ===========================================================================
// GET /profiles/:id - Get profile by ID
// ===========================================================================

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getSafeOSDatabase();

    const profile = await db.get('SELECT * FROM monitoring_profiles WHERE id = ?', [id]);

    if (!profile) {
      res.status(404).json({
        success: false,
        error: 'Profile not found',
      } as ApiResponse);
      return;
    }

    // Get usage count
    const usageCount = await db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM streams WHERE profile_id = ?',
      [id]
    );

    res.json({
      success: true,
      data: {
        ...profile,
        usageCount: usageCount?.count || 0,
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
// GET /profiles/scenario/:scenario - Get profiles by scenario
// ===========================================================================

router.get('/scenario/:scenario', async (req: Request, res: Response) => {
  try {
    const { scenario } = req.params;

    if (!['pet', 'baby', 'elderly'].includes(scenario)) {
      res.status(400).json({
        success: false,
        error: 'Invalid scenario',
      } as ApiResponse);
      return;
    }

    const db = await getSafeOSDatabase();
    const profiles = await db.all(
      'SELECT * FROM monitoring_profiles WHERE scenario = ? ORDER BY name',
      [scenario]
    );

    res.json({
      success: true,
      data: profiles,
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

// ===========================================================================
// POST /profiles - Create profile
// ===========================================================================

router.post('/', async (req: Request, res: Response) => {
  try {
    const parseResult = CreateProfileSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: parseResult.error.errors.map((e) => e.message).join(', '),
      } as ApiResponse);
      return;
    }

    const {
      name,
      scenario,
      motionThreshold,
      audioThreshold,
      alertSpeed,
      description,
      customPrompt,
    } = parseResult.data;

    const db = await getSafeOSDatabase();
    const id = generateId();
    const timestamp = now();

    await db.run(
      `INSERT INTO monitoring_profiles 
       (id, name, scenario, motion_threshold, audio_threshold, alert_speed, description, custom_prompt, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        scenario,
        motionThreshold,
        audioThreshold,
        alertSpeed,
        description || null,
        customPrompt || null,
        timestamp,
      ]
    );

    const profile = await db.get('SELECT * FROM monitoring_profiles WHERE id = ?', [id]);

    res.status(201).json({
      success: true,
      data: profile,
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

// ===========================================================================
// PUT /profiles/:id - Update profile
// ===========================================================================

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parseResult = UpdateProfileSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: parseResult.error.errors.map((e) => e.message).join(', '),
      } as ApiResponse);
      return;
    }

    const db = await getSafeOSDatabase();

    // Check if profile exists
    const existing = await db.get('SELECT * FROM monitoring_profiles WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({
        success: false,
        error: 'Profile not found',
      } as ApiResponse);
      return;
    }

    const updates: string[] = [];
    const params: (string | number | null)[] = [];
    const data = parseResult.data;

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }
    if (data.scenario !== undefined) {
      updates.push('scenario = ?');
      params.push(data.scenario);
    }
    if (data.motionThreshold !== undefined) {
      updates.push('motion_threshold = ?');
      params.push(data.motionThreshold);
    }
    if (data.audioThreshold !== undefined) {
      updates.push('audio_threshold = ?');
      params.push(data.audioThreshold);
    }
    if (data.alertSpeed !== undefined) {
      updates.push('alert_speed = ?');
      params.push(data.alertSpeed);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description);
    }
    if (data.customPrompt !== undefined) {
      updates.push('custom_prompt = ?');
      params.push(data.customPrompt);
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(now());
      params.push(id);

      await db.run(
        `UPDATE monitoring_profiles SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }

    const profile = await db.get('SELECT * FROM monitoring_profiles WHERE id = ?', [id]);

    res.json({
      success: true,
      data: profile,
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

// ===========================================================================
// DELETE /profiles/:id - Delete profile
// ===========================================================================

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getSafeOSDatabase();

    // Check if profile exists
    const existing = await db.get('SELECT * FROM monitoring_profiles WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({
        success: false,
        error: 'Profile not found',
      } as ApiResponse);
      return;
    }

    // Check if profile is in use
    const usage = await db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM streams WHERE profile_id = ?',
      [id]
    );

    if (usage && usage.count > 0) {
      res.status(400).json({
        success: false,
        error: `Profile is in use by ${usage.count} stream(s)`,
      } as ApiResponse);
      return;
    }

    await db.run('DELETE FROM monitoring_profiles WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Profile deleted',
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

// ===========================================================================
// POST /profiles/:id/duplicate - Duplicate profile
// ===========================================================================

router.post('/:id/duplicate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body as { name?: string };
    const db = await getSafeOSDatabase();

    // Get original profile
    const original = await db.get('SELECT * FROM monitoring_profiles WHERE id = ?', [id]);
    if (!original) {
      res.status(404).json({
        success: false,
        error: 'Profile not found',
      } as ApiResponse);
      return;
    }

    const newId = generateId();
    const timestamp = now();
    const newName = name || `${(original as { name: string }).name} (Copy)`;

    await db.run(
      `INSERT INTO monitoring_profiles 
       (id, name, scenario, motion_threshold, audio_threshold, alert_speed, description, custom_prompt, created_at)
       SELECT ?, ?, scenario, motion_threshold, audio_threshold, alert_speed, description, custom_prompt, ?
       FROM monitoring_profiles WHERE id = ?`,
      [newId, newName, timestamp, id]
    );

    const profile = await db.get('SELECT * FROM monitoring_profiles WHERE id = ?', [newId]);

    res.status(201).json({
      success: true,
      data: profile,
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    } as ApiResponse);
  }
});

export default router;


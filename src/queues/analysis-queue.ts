/**
 * Analysis Job Queue
 *
 * Queue-based frame analysis with priority handling and worker distribution.
 * Designed for horizontal scaling - add more workers as needed.
 *
 * @module queues/analysis-queue
 */

import type { MonitoringScenario, AnalysisResult } from '../types/index.js';
import { getSafeOSDatabase, generateId, now } from '../db/index.js';
import { getDefaultFrameAnalyzer } from '../lib/analysis/frame-analyzer.js';
import { getDefaultContentFilter } from '../lib/safety/content-filter.js';
import { getDefaultEscalationManager } from '../lib/alerts/escalation.js';
import { EventEmitter } from 'events';

// =============================================================================
// Types
// =============================================================================

export type JobPriority = 'low' | 'normal' | 'high' | 'urgent';
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface AnalysisJob {
  id: string;
  streamId: string;
  frameData: string;
  scenario: MonitoringScenario;
  priority: JobPriority;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  error?: string;
  result?: AnalysisResult;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  byPriority: Record<JobPriority, number>;
}

// =============================================================================
// Priority Configuration
// =============================================================================

const PRIORITY_ORDER: Record<JobPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

// Scenario to priority mapping (baby > elderly > pet by default)
const SCENARIO_PRIORITY: Record<MonitoringScenario, JobPriority> = {
  baby: 'high',
  elderly: 'high',
  pet: 'normal',
};

// =============================================================================
// Analysis Queue Class
// =============================================================================

export class AnalysisQueue extends EventEmitter {
  private processing = false;
  private concurrency = 2;
  private activeJobs = new Map<string, AbortController>();
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options?: { concurrency?: number }) {
    super();
    this.concurrency = options?.concurrency ?? 2;
  }

  // ===========================================================================
  // Queue Operations
  // ===========================================================================

  /**
   * Add a job to the queue
   */
  async enqueue(params: {
    streamId: string;
    frameData: string;
    scenario: MonitoringScenario;
    priority?: JobPriority;
  }): Promise<string> {
    const db = await getSafeOSDatabase();
    const id = generateId();
    const timestamp = now();

    // Use scenario-based priority if not specified
    const priority = params.priority ?? SCENARIO_PRIORITY[params.scenario];

    await db.run(
      `INSERT INTO analysis_queue 
       (id, stream_id, frame_data, scenario, priority, status, attempts, max_attempts, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', 0, 3, ?)`,
      [id, params.streamId, params.frameData, params.scenario, priority, timestamp]
    );

    this.emit('job:queued', { jobId: id, priority });
    console.log(`[AnalysisQueue] Job ${id} queued with priority ${priority}`);

    return id;
  }

  /**
   * Get the next pending job (highest priority, oldest first)
   */
  async dequeue(): Promise<AnalysisJob | null> {
    const db = await getSafeOSDatabase();

    // Get next job ordered by priority and creation time
    const job = await db.get<{
      id: string;
      stream_id: string;
      frame_data: string;
      scenario: string;
      priority: string;
      status: string;
      attempts: number;
      max_attempts: number;
      error: string | null;
      created_at: string;
      started_at: string | null;
      completed_at: string | null;
    }>(
      `SELECT * FROM analysis_queue 
       WHERE status = 'pending'
       ORDER BY 
         CASE priority 
           WHEN 'urgent' THEN 0 
           WHEN 'high' THEN 1 
           WHEN 'normal' THEN 2 
           WHEN 'low' THEN 3 
         END,
         created_at ASC
       LIMIT 1`
    );

    if (!job) {
      return null;
    }

    // Mark as processing
    await db.run(
      `UPDATE analysis_queue SET status = 'processing', started_at = ? WHERE id = ?`,
      [now(), job.id]
    );

    return {
      id: job.id,
      streamId: job.stream_id,
      frameData: job.frame_data,
      scenario: job.scenario as MonitoringScenario,
      priority: job.priority as JobPriority,
      status: 'processing',
      attempts: job.attempts,
      maxAttempts: job.max_attempts,
      error: job.error ?? undefined,
      createdAt: job.created_at,
      startedAt: job.started_at ?? undefined,
      completedAt: job.completed_at ?? undefined,
    };
  }

  /**
   * Mark a job as completed
   */
  async complete(jobId: string, result: AnalysisResult): Promise<void> {
    const db = await getSafeOSDatabase();
    const timestamp = now();

    await db.run(
      `UPDATE analysis_queue 
       SET status = 'completed', completed_at = ?
       WHERE id = ?`,
      [timestamp, jobId]
    );

    // Store the analysis result
    await db.run(
      `INSERT INTO analysis_results 
       (id, stream_id, scenario, concern_level, description, model_used, inference_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        result.id,
        result.streamId,
        result.scenario,
        result.concernLevel,
        result.description,
        result.modelUsed,
        result.inferenceMs,
        timestamp,
      ]
    );

    this.activeJobs.delete(jobId);
    this.emit('job:completed', { jobId, result });
  }

  /**
   * Mark a job as failed
   */
  async fail(jobId: string, error: string): Promise<void> {
    const db = await getSafeOSDatabase();

    // Get current attempt count
    const job = await db.get<{ attempts: number; max_attempts: number }>(
      'SELECT attempts, max_attempts FROM analysis_queue WHERE id = ?',
      [jobId]
    );

    if (!job) {
      return;
    }

    const newAttempts = job.attempts + 1;

    if (newAttempts < job.max_attempts) {
      // Retry later
      await db.run(
        `UPDATE analysis_queue 
         SET status = 'pending', attempts = ?, error = ?
         WHERE id = ?`,
        [newAttempts, error, jobId]
      );
      console.log(`[AnalysisQueue] Job ${jobId} will retry (attempt ${newAttempts}/${job.max_attempts})`);
    } else {
      // Max retries exceeded
      await db.run(
        `UPDATE analysis_queue 
         SET status = 'failed', attempts = ?, error = ?, completed_at = ?
         WHERE id = ?`,
        [newAttempts, error, now(), jobId]
      );
      console.log(`[AnalysisQueue] Job ${jobId} failed after ${newAttempts} attempts`);
    }

    this.activeJobs.delete(jobId);
    this.emit('job:failed', { jobId, error });
  }

  // ===========================================================================
  // Worker Processing
  // ===========================================================================

  /**
   * Start processing jobs
   */
  start(): void {
    if (this.processing) {
      return;
    }

    this.processing = true;
    this.pollInterval = setInterval(() => {
      void this.processJobs();
    }, 500);

    console.log('[AnalysisQueue] Started processing');
    this.emit('queue:started');
  }

  /**
   * Stop processing jobs
   */
  stop(): void {
    this.processing = false;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    // Cancel active jobs
    for (const [jobId, controller] of this.activeJobs) {
      controller.abort();
      console.log(`[AnalysisQueue] Cancelled job ${jobId}`);
    }
    this.activeJobs.clear();

    console.log('[AnalysisQueue] Stopped processing');
    this.emit('queue:stopped');
  }

  /**
   * Process pending jobs up to concurrency limit
   */
  private async processJobs(): Promise<void> {
    if (!this.processing) {
      return;
    }

    // Check if we can take more jobs
    while (this.activeJobs.size < this.concurrency) {
      const job = await this.dequeue();
      if (!job) {
        break; // No more pending jobs
      }

      // Process job in background
      const controller = new AbortController();
      this.activeJobs.set(job.id, controller);

      void this.processJob(job, controller.signal);
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: AnalysisJob, signal: AbortSignal): Promise<void> {
    try {
      console.log(`[AnalysisQueue] Processing job ${job.id}`);

      // Check for abort
      if (signal.aborted) {
        return;
      }

      // Run content moderation first
      const filter = getDefaultContentFilter();
      const modResult = await filter.moderate(job.frameData);

      if (modResult.action === 'block' || modResult.action === 'escalate') {
        // Content blocked - create flag and skip analysis
        const flag = filter.createFlag(job.streamId, job.id, modResult);
        const db = await getSafeOSDatabase();
        await db.run(
          `INSERT INTO content_flags 
           (id, stream_id, frame_id, tier, categories, status, created_at)
           VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
          [flag.id, flag.streamId, flag.frameId, flag.tier, JSON.stringify(flag.categories), now()]
        );

        await this.complete(job.id, {
          id: generateId(),
          streamId: job.streamId,
          scenario: job.scenario,
          concernLevel: 'none',
          description: 'Content flagged for review',
          modelUsed: 'content-filter',
          inferenceMs: 0,
          createdAt: now(),
        });
        return;
      }

      // Check for abort again
      if (signal.aborted) {
        return;
      }

      // Run frame analysis
      const analyzer = getDefaultFrameAnalyzer();
      const result = await analyzer.analyze({
        streamId: job.streamId,
        frameData: job.frameData,
        scenario: job.scenario,
      });

      // Check for concerning results and create alerts
      if (result.concernLevel !== 'none') {
        await this.createAlert(result);
      }

      await this.complete(job.id, result);
    } catch (error) {
      await this.fail(job.id, String(error));
    }
  }

  /**
   * Create an alert from an analysis result
   */
  private async createAlert(result: AnalysisResult): Promise<void> {
    const db = await getSafeOSDatabase();
    const alertId = generateId();
    const timestamp = now();

    // Map concern level to severity
    const severityMap: Record<string, string> = {
      low: 'info',
      medium: 'warning',
      high: 'urgent',
      critical: 'critical',
    };

    const severity = severityMap[result.concernLevel] || 'info';

    await db.run(
      `INSERT INTO alerts 
       (id, stream_id, analysis_id, alert_type, severity, message, escalation_level, acknowledged, created_at)
       VALUES (?, ?, ?, 'concern', ?, ?, 0, 0, ?)`,
      [alertId, result.streamId, result.id, severity, result.description, timestamp]
    );

    // Start escalation tracking
    const escalation = getDefaultEscalationManager();
    escalation.startAlert({
      id: alertId,
      streamId: result.streamId,
      analysisId: result.id,
      alertType: 'concern',
      severity: severity as 'info' | 'warning' | 'urgent' | 'critical',
      message: result.description,
      escalationLevel: 0,
      acknowledged: false,
      createdAt: timestamp,
    });

    this.emit('alert:created', { alertId, result });
  }

  // ===========================================================================
  // Stats
  // ===========================================================================

  async getStats(): Promise<QueueStats> {
    const db = await getSafeOSDatabase();

    const counts = await db.all<{ status: string; count: number }>(
      `SELECT status, COUNT(*) as count FROM analysis_queue GROUP BY status`
    );

    const priorities = await db.all<{ priority: string; count: number }>(
      `SELECT priority, COUNT(*) as count FROM analysis_queue WHERE status = 'pending' GROUP BY priority`
    );

    const stats: QueueStats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      byPriority: { urgent: 0, high: 0, normal: 0, low: 0 },
    };

    for (const row of counts) {
      if (row.status in stats) {
        (stats as Record<string, number>)[row.status] = row.count;
      }
    }

    for (const row of priorities) {
      if (row.priority in stats.byPriority) {
        stats.byPriority[row.priority as JobPriority] = row.count;
      }
    }

    return stats;
  }
}

// =============================================================================
// Singleton
// =============================================================================

let defaultQueue: AnalysisQueue | null = null;

export function getDefaultAnalysisQueue(): AnalysisQueue {
  if (!defaultQueue) {
    defaultQueue = new AnalysisQueue();
  }
  return defaultQueue;
}


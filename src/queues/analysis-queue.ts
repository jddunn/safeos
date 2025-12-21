/**
 * Analysis Queue
 *
 * BullMQ-compatible queue for processing frame analysis jobs.
 * Handles prioritization, concurrency, and fallback to cloud.
 *
 * @module queues/analysis-queue
 */

import type {
  AnalysisJob,
  AnalysisResult,
  ConcernLevel,
  MonitoringScenario,
  AlertSeverity,
} from '../types/index.js';
import { getSafeOSDatabase, generateId, now } from '../db/index.js';
import { getDefaultOllamaClient } from '../lib/ollama/client.js';
import { getDefaultCloudFallback } from '../lib/analysis/cloud-fallback.js';
import { getDefaultContentFilter } from '../lib/safety/content-filter.js';
import { getDefaultAudioAnalyzer } from '../lib/audio/analyzer.js';

// =============================================================================
// Configuration
// =============================================================================

export interface AnalysisQueueConfig {
  concurrency: number;
  localTimeout: number;
  cloudFallbackEnabled: boolean;
  contentFilterEnabled: boolean;
  priorityLevels: {
    motion: number;
    audio: number;
    scheduled: number;
  };
  retryAttempts: number;
  retryDelay: number;
}

const DEFAULT_CONFIG: AnalysisQueueConfig = {
  concurrency: 3,
  localTimeout: 15000,
  cloudFallbackEnabled: true,
  contentFilterEnabled: true,
  priorityLevels: {
    motion: 10,
    audio: 15, // Audio events get higher priority
    scheduled: 5,
  },
  retryAttempts: 2,
  retryDelay: 1000,
};

// =============================================================================
// Types
// =============================================================================

interface QueuedJob {
  id: string;
  job: AnalysisJob;
  priority: number;
  attempts: number;
  createdAt: number;
  startedAt: number | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

type JobCallback = (result: AnalysisResult) => void | Promise<void>;
type AlertCallback = (alert: {
  streamId: string;
  type: string;
  severity: AlertSeverity;
  message: string;
  analysisId: string;
}) => void | Promise<void>;

// =============================================================================
// Analysis Queue
// =============================================================================

export class AnalysisQueue {
  private config: AnalysisQueueConfig;
  private queue: Map<string, QueuedJob> = new Map();
  private processing: Set<string> = new Set();
  private isRunning = false;
  private processedCount = 0;
  private failedCount = 0;
  private jobCallbacks: JobCallback[] = [];
  private alertCallbacks: AlertCallback[] = [];

  constructor(config?: Partial<AnalysisQueueConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===========================================================================
  // Queue Management
  // ===========================================================================

  /**
   * Add a job to the queue
   */
  async enqueue(job: AnalysisJob): Promise<string> {
    const id = generateId();
    const priority = this.calculatePriority(job);

    const queuedJob: QueuedJob = {
      id,
      job,
      priority,
      attempts: 0,
      createdAt: Date.now(),
      startedAt: null,
      status: 'pending',
    };

    this.queue.set(id, queuedJob);

    // Store in database for persistence
    const db = await getSafeOSDatabase();
    await db.run(
      `INSERT INTO analysis_queue (
        id, stream_id, frame_id, scenario, priority, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, job.streamId, job.frameId, job.scenario, priority, 'pending', now()]
    );

    console.log(
      `[AnalysisQueue] Enqueued job ${id} for stream ${job.streamId} (priority: ${priority})`
    );

    // Trigger processing if not already running
    this.processNext();

    return id;
  }

  /**
   * Start processing jobs
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[AnalysisQueue] Started processing');
    this.processNext();
  }

  /**
   * Stop processing (finish current jobs)
   */
  stop(): void {
    this.isRunning = false;
    console.log('[AnalysisQueue] Stopped processing');
  }

  /**
   * Get queue status
   */
  getStatus(): {
    pending: number;
    processing: number;
    processed: number;
    failed: number;
    isRunning: boolean;
  } {
    return {
      pending: Array.from(this.queue.values()).filter(
        (j) => j.status === 'pending'
      ).length,
      processing: this.processing.size,
      processed: this.processedCount,
      failed: this.failedCount,
      isRunning: this.isRunning,
    };
  }

  // ===========================================================================
  // Processing
  // ===========================================================================

  private async processNext(): Promise<void> {
    if (!this.isRunning) return;
    if (this.processing.size >= this.config.concurrency) return;

    // Get highest priority pending job
    const nextJob = this.getNextPendingJob();
    if (!nextJob) return;

    // Mark as processing
    nextJob.status = 'processing';
    nextJob.startedAt = Date.now();
    nextJob.attempts++;
    this.processing.add(nextJob.id);

    try {
      const result = await this.processJob(nextJob);

      // Success
      nextJob.status = 'completed';
      this.processedCount++;
      this.queue.delete(nextJob.id);

      // Notify callbacks
      for (const callback of this.jobCallbacks) {
        try {
          await callback(result);
        } catch (error) {
          console.error('[AnalysisQueue] Callback error:', error);
        }
      }

      // Check if we need to create an alert
      if (this.shouldCreateAlert(result)) {
        await this.createAlert(nextJob.job, result);
      }

      // Update database
      const db = await getSafeOSDatabase();
      await db.run(
        'UPDATE analysis_queue SET status = ?, completed_at = ? WHERE id = ?',
        ['completed', now(), nextJob.id]
      );
    } catch (error) {
      console.error(`[AnalysisQueue] Job ${nextJob.id} failed:`, error);

      if (nextJob.attempts < this.config.retryAttempts) {
        // Retry
        nextJob.status = 'pending';
        console.log(
          `[AnalysisQueue] Retrying job ${nextJob.id} (attempt ${nextJob.attempts + 1})`
        );
      } else {
        // Mark as failed
        nextJob.status = 'failed';
        this.failedCount++;
        this.queue.delete(nextJob.id);

        const db = await getSafeOSDatabase();
        await db.run(
          'UPDATE analysis_queue SET status = ?, error = ? WHERE id = ?',
          ['failed', String(error), nextJob.id]
        );
      }
    } finally {
      this.processing.delete(nextJob.id);
    }

    // Process next
    setTimeout(() => this.processNext(), 10);
  }

  private getNextPendingJob(): QueuedJob | null {
    const pending = Array.from(this.queue.values())
      .filter((j) => j.status === 'pending')
      .sort((a, b) => {
        // Higher priority first
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        // Then by creation time (older first)
        return a.createdAt - b.createdAt;
      });

    return pending[0] || null;
  }

  private async processJob(queuedJob: QueuedJob): Promise<AnalysisResult> {
    const { job } = queuedJob;
    const startTime = Date.now();

    let result: AnalysisResult;

    try {
      // Try local Ollama first
      const ollama = getDefaultOllamaClient();

      if (await ollama.isHealthy()) {
        // Triage with fast model
        const triageResult = await this.runWithTimeout(
          ollama.triage(job.frameBase64, job.scenario),
          this.config.localTimeout / 2
        );

        // If triage shows concern, run detailed analysis
        if (this.needsDetailedAnalysis(triageResult.concernLevel)) {
          result = await this.runWithTimeout(
            ollama.analyze(job.frameBase64, job.scenario),
            this.config.localTimeout
          );
          result.triageResult = triageResult.concernLevel;
        } else {
          // Convert triage to full result
          result = {
            id: generateId(),
            streamId: job.streamId,
            frameId: job.frameId,
            timestamp: now(),
            concernLevel: triageResult.concernLevel,
            confidence: triageResult.confidence,
            description: triageResult.description,
            detectedIssues: [],
            recommendedAction: null,
            processingTimeMs: Date.now() - startTime,
            model: 'moondream',
            isCloudFallback: false,
            triageResult: triageResult.concernLevel,
          };
        }
      } else {
        throw new Error('Ollama not available');
      }
    } catch (error) {
      // Fallback to cloud
      if (this.config.cloudFallbackEnabled) {
        console.log('[AnalysisQueue] Falling back to cloud LLM');
        const cloudFallback = getDefaultCloudFallback();
        result = await cloudFallback.analyze(job.frameBase64, job.scenario);
        result.streamId = job.streamId;
        result.frameId = job.frameId;
      } else {
        throw error;
      }
    }

    // Run content filter if enabled
    if (this.config.contentFilterEnabled) {
      const contentFilter = getDefaultContentFilter();
      const moderation = await contentFilter.moderate(
        job.frameBase64,
        job.streamId,
        job.scenario
      );

      if (!moderation.isSafe) {
        result.contentFlag = moderation;
      }
    }

    // Store result in database
    const db = await getSafeOSDatabase();
    await db.run(
      `INSERT INTO analysis_results (
        id, stream_id, frame_id, concern_level, confidence,
        description, detected_issues, model, is_cloud_fallback,
        processing_time_ms, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        result.id,
        result.streamId,
        result.frameId,
        result.concernLevel,
        result.confidence,
        result.description,
        JSON.stringify(result.detectedIssues),
        result.model,
        result.isCloudFallback ? 1 : 0,
        result.processingTimeMs,
        result.timestamp,
      ]
    );

    return result;
  }

  // ===========================================================================
  // Audio Analysis Integration
  // ===========================================================================

  /**
   * Process audio analysis
   */
  async processAudio(
    streamId: string,
    samples: Float32Array | number[],
    sampleRate: number,
    rmsLevel: number,
    scenario: MonitoringScenario
  ): Promise<void> {
    const audioAnalyzer = getDefaultAudioAnalyzer();

    const results = await audioAnalyzer.analyze(
      {
        samples,
        sampleRate,
        channelCount: 1,
        durationMs: (samples.length / sampleRate) * 1000,
        rmsLevel,
      },
      scenario
    );

    // Check for concerning audio events
    for (const result of results) {
      if (result.detected && result.concernLevel !== 'none') {
        await this.createAudioAlert(streamId, result, scenario);
      }
    }
  }

  private async createAudioAlert(
    streamId: string,
    audioResult: {
      type: string;
      confidence: number;
      concernLevel: ConcernLevel;
      details: string;
    },
    scenario: MonitoringScenario
  ): Promise<void> {
    const severity = this.concernToSeverity(audioResult.concernLevel);

    const alert = {
      streamId,
      type: 'audio',
      severity,
      message: `Audio alert: ${audioResult.type} detected - ${audioResult.details}`,
      analysisId: generateId(),
    };

    // Notify alert callbacks
    for (const callback of this.alertCallbacks) {
      try {
        await callback(alert);
      } catch (error) {
        console.error('[AnalysisQueue] Alert callback error:', error);
      }
    }

    // Store in database
    const db = await getSafeOSDatabase();
    await db.run(
      `INSERT INTO alerts (
        id, stream_id, alert_type, severity, message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [alert.analysisId, streamId, 'audio', severity, alert.message, now()]
    );
  }

  // ===========================================================================
  // Alert Creation
  // ===========================================================================

  private shouldCreateAlert(result: AnalysisResult): boolean {
    return result.concernLevel !== 'none' && result.concernLevel !== 'low';
  }

  private async createAlert(job: AnalysisJob, result: AnalysisResult): Promise<void> {
    const severity = this.concernToSeverity(result.concernLevel);

    const alert = {
      streamId: job.streamId,
      type: 'concern',
      severity,
      message: result.description,
      analysisId: result.id,
    };

    // Notify alert callbacks
    for (const callback of this.alertCallbacks) {
      try {
        await callback(alert);
      } catch (error) {
        console.error('[AnalysisQueue] Alert callback error:', error);
      }
    }

    // Store in database
    const db = await getSafeOSDatabase();
    await db.run(
      `INSERT INTO alerts (
        id, stream_id, alert_type, severity, message, analysis_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [generateId(), job.streamId, 'concern', severity, result.description, result.id, now()]
    );
  }

  private concernToSeverity(level: ConcernLevel): AlertSeverity {
    switch (level) {
      case 'critical':
        return 'critical';
      case 'high':
        return 'urgent';
      case 'medium':
        return 'warning';
      default:
        return 'info';
    }
  }

  // ===========================================================================
  // Utility
  // ===========================================================================

  private calculatePriority(job: AnalysisJob): number {
    let priority = this.config.priorityLevels.scheduled;

    // Higher priority for motion/audio triggered
    if (job.trigger === 'motion') {
      priority = this.config.priorityLevels.motion;
    } else if (job.trigger === 'audio') {
      priority = this.config.priorityLevels.audio;
    }

    // Boost priority for high motion scores
    if (job.motionScore && job.motionScore > 0.7) {
      priority += 5;
    }

    // Boost priority for high audio levels
    if (job.audioLevel && job.audioLevel > 0.8) {
      priority += 5;
    }

    return priority;
  }

  private needsDetailedAnalysis(triageResult: ConcernLevel): boolean {
    return triageResult !== 'none';
  }

  private async runWithTimeout<T>(
    promise: Promise<T>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeout)
      ),
    ]);
  }

  // ===========================================================================
  // Callbacks
  // ===========================================================================

  onJobComplete(callback: JobCallback): void {
    this.jobCallbacks.push(callback);
  }

  onAlert(callback: AlertCallback): void {
    this.alertCallbacks.push(callback);
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  updateConfig(config: Partial<AnalysisQueueConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): AnalysisQueueConfig {
    return { ...this.config };
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

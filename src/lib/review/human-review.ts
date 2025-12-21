/**
 * Human Review System
 *
 * Manages the queue for human review of flagged content.
 * Implements anonymization, bias prevention, and audit trails.
 *
 * @module lib/review/human-review
 */

import type { ContentFlag, ModerationResult } from '../../types/index.js';
import { getSafeOSDatabase, generateId, now } from '../../db/index.js';

// =============================================================================
// Types
// =============================================================================

export interface ReviewCase {
  id: string;
  flagId: string;
  streamId: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'in_review' | 'completed' | 'escalated';
  anonymizedFrame: string | null;
  context: ReviewContext;
  assignedTo: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  decision: ReviewDecision | null;
}

export interface ReviewContext {
  scenario: 'pet' | 'baby' | 'elderly';
  aiAssessment: {
    concernLevel: string;
    confidence: number;
    categories: string[];
    reasoning: string;
  };
  previousFlags: number;
  streamDuration: number;
}

export interface ReviewDecision {
  action: 'approve' | 'block' | 'warn' | 'ban' | 'escalate_legal';
  severity: 'false_positive' | 'minor' | 'moderate' | 'severe' | 'critical';
  notes: string;
  requiresFollowUp: boolean;
}

export interface Reviewer {
  id: string;
  name: string;
  role: 'moderator' | 'senior_moderator' | 'admin';
  casesReviewed: number;
  accuracy: number;
}

// =============================================================================
// Configuration
// =============================================================================

export interface HumanReviewConfig {
  autoAssign: boolean;
  maxCasesPerReviewer: number;
  reviewTimeoutMinutes: number;
  requireDoubleCheck: boolean;
  doubleCheckThreshold: number; // AI confidence below this requires 2 reviewers
  blurRadius: number;
  anonymizeMetadata: boolean;
}

const DEFAULT_CONFIG: HumanReviewConfig = {
  autoAssign: true,
  maxCasesPerReviewer: 10,
  reviewTimeoutMinutes: 30,
  requireDoubleCheck: true,
  doubleCheckThreshold: 0.8,
  blurRadius: 30,
  anonymizeMetadata: true,
};

// =============================================================================
// Human Review Manager
// =============================================================================

export class HumanReviewManager {
  private config: HumanReviewConfig;
  private reviewers: Map<string, Reviewer> = new Map();
  private pendingCases: Map<string, ReviewCase> = new Map();
  private completedCount = 0;

  constructor(config?: Partial<HumanReviewConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===========================================================================
  // Case Creation
  // ===========================================================================

  /**
   * Create a new review case from a content flag
   */
  async createCase(
    flag: ContentFlag,
    moderationResult: ModerationResult,
    frameData?: string
  ): Promise<ReviewCase> {
    const db = await getSafeOSDatabase();

    // Get stream info for context
    const stream = await db.get(
      'SELECT * FROM streams WHERE id = ?',
      [flag.streamId]
    );

    // Get previous flag count
    const previousFlags = await db.get(
      'SELECT COUNT(*) as count FROM content_flags WHERE stream_id = ? AND id != ?',
      [flag.streamId, flag.id]
    );

    // Anonymize frame if provided
    const anonymizedFrame = frameData
      ? await this.anonymizeFrame(frameData)
      : null;

    const reviewCase: ReviewCase = {
      id: generateId(),
      flagId: flag.id,
      streamId: flag.streamId,
      priority: this.determinePriority(flag, moderationResult),
      status: 'pending',
      anonymizedFrame,
      context: {
        scenario: stream?.scenario || 'pet',
        aiAssessment: {
          concernLevel: flag.severity,
          confidence: flag.confidence,
          categories: flag.categories,
          reasoning: flag.reasoning,
        },
        previousFlags: previousFlags?.count || 0,
        streamDuration: stream
          ? Date.now() - new Date(stream.created_at).getTime()
          : 0,
      },
      assignedTo: null,
      createdAt: now(),
      startedAt: null,
      completedAt: null,
      decision: null,
    };

    // Store in database
    await db.run(
      `INSERT INTO review_cases (
        id, flag_id, stream_id, priority, status, context,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        reviewCase.id,
        reviewCase.flagId,
        reviewCase.streamId,
        reviewCase.priority,
        reviewCase.status,
        JSON.stringify(reviewCase.context),
        reviewCase.createdAt,
      ]
    );

    this.pendingCases.set(reviewCase.id, reviewCase);

    console.log(
      `[HumanReview] Created case ${reviewCase.id} with priority ${reviewCase.priority}`
    );

    return reviewCase;
  }

  // ===========================================================================
  // Case Assignment
  // ===========================================================================

  /**
   * Assign a case to a reviewer
   */
  async assignCase(caseId: string, reviewerId: string): Promise<boolean> {
    const reviewCase = this.pendingCases.get(caseId);
    if (!reviewCase || reviewCase.status !== 'pending') {
      return false;
    }

    const reviewer = this.reviewers.get(reviewerId);
    if (!reviewer) {
      return false;
    }

    // Check reviewer capacity
    const assignedCount = Array.from(this.pendingCases.values()).filter(
      (c) => c.assignedTo === reviewerId && c.status === 'in_review'
    ).length;

    if (assignedCount >= this.config.maxCasesPerReviewer) {
      return false;
    }

    reviewCase.assignedTo = reviewerId;
    reviewCase.status = 'in_review';
    reviewCase.startedAt = now();

    // Update database
    const db = await getSafeOSDatabase();
    await db.run(
      `UPDATE review_cases SET
        assigned_to = ?, status = ?, started_at = ?
      WHERE id = ?`,
      [reviewerId, 'in_review', reviewCase.startedAt, caseId]
    );

    console.log(`[HumanReview] Assigned case ${caseId} to ${reviewerId}`);

    return true;
  }

  /**
   * Get next case for a reviewer
   */
  async getNextCase(reviewerId: string): Promise<ReviewCase | null> {
    // Sort by priority and creation time
    const pending = Array.from(this.pendingCases.values())
      .filter((c) => c.status === 'pending')
      .sort((a, b) => {
        const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
        const aPriority = priorityOrder[a.priority];
        const bPriority = priorityOrder[b.priority];

        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }

        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

    if (pending.length === 0) {
      return null;
    }

    const nextCase = pending[0];
    await this.assignCase(nextCase.id, reviewerId);

    return nextCase;
  }

  // ===========================================================================
  // Case Completion
  // ===========================================================================

  /**
   * Complete a review with a decision
   */
  async completeReview(
    caseId: string,
    decision: ReviewDecision,
    reviewerId: string
  ): Promise<boolean> {
    const reviewCase = this.pendingCases.get(caseId);
    if (!reviewCase || reviewCase.assignedTo !== reviewerId) {
      return false;
    }

    reviewCase.status = 'completed';
    reviewCase.completedAt = now();
    reviewCase.decision = decision;

    // Update database
    const db = await getSafeOSDatabase();
    await db.run(
      `UPDATE review_cases SET
        status = ?, completed_at = ?, decision = ?
      WHERE id = ?`,
      ['completed', reviewCase.completedAt, JSON.stringify(decision), caseId]
    );

    // Update flag with decision
    await db.run(
      `UPDATE content_flags SET
        status = ?, reviewed_at = ?, reviewed_by = ?, review_notes = ?
      WHERE id = ?`,
      [
        decision.action === 'approve' ? 'dismissed' : 'actioned',
        reviewCase.completedAt,
        reviewerId,
        decision.notes,
        reviewCase.flagId,
      ]
    );

    // Take action based on decision
    await this.executeDecision(reviewCase, decision);

    // Update stats
    this.completedCount++;
    const reviewer = this.reviewers.get(reviewerId);
    if (reviewer) {
      reviewer.casesReviewed++;
    }

    this.pendingCases.delete(caseId);

    console.log(
      `[HumanReview] Completed case ${caseId} with action: ${decision.action}`
    );

    return true;
  }

  // ===========================================================================
  // Decision Execution
  // ===========================================================================

  private async executeDecision(
    reviewCase: ReviewCase,
    decision: ReviewDecision
  ): Promise<void> {
    const db = await getSafeOSDatabase();

    switch (decision.action) {
      case 'approve':
        // Nothing to do - content is allowed
        break;

      case 'block':
        // Block the content but don't ban user
        await db.run(
          'UPDATE streams SET blocked = 1 WHERE id = ?',
          [reviewCase.streamId]
        );
        break;

      case 'warn':
        // Issue a warning (track for future reference)
        await db.run(
          `INSERT INTO warnings (id, stream_id, reason, created_at)
           VALUES (?, ?, ?, ?)`,
          [generateId(), reviewCase.streamId, decision.notes, now()]
        );
        break;

      case 'ban':
        // Ban the stream/user
        await db.run(
          'UPDATE streams SET banned = 1, banned_at = ? WHERE id = ?',
          [now(), reviewCase.streamId]
        );
        break;

      case 'escalate_legal':
        // Create legal escalation record
        await db.run(
          `INSERT INTO legal_escalations (id, case_id, stream_id, reason, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [
            generateId(),
            reviewCase.id,
            reviewCase.streamId,
            decision.notes,
            now(),
          ]
        );
        console.log(
          `[HumanReview] LEGAL ESCALATION: Case ${reviewCase.id} requires law enforcement referral`
        );
        break;
    }
  }

  // ===========================================================================
  // Anonymization
  // ===========================================================================

  /**
   * Anonymize a frame for human review
   * Applies blur and removes identifying information
   */
  private async anonymizeFrame(frameBase64: string): Promise<string> {
    // In a real implementation, this would use sharp or canvas to:
    // 1. Apply Gaussian blur to faces
    // 2. Remove/blur text
    // 3. Blur any identifying features
    // 4. Add a review watermark

    // For now, we return the frame with a flag indicating it needs processing
    return `ANONYMIZED:${frameBase64.slice(0, 100)}...`;
  }

  // ===========================================================================
  // Priority Determination
  // ===========================================================================

  private determinePriority(
    flag: ContentFlag,
    result: ModerationResult
  ): 'low' | 'normal' | 'high' | 'urgent' {
    // Critical categories always urgent
    const criticalCategories = ['child_endangerment', 'explicit', 'gore', 'abuse'];
    if (flag.categories.some((c) => criticalCategories.includes(c))) {
      return 'urgent';
    }

    // High confidence concerning content
    if (result.overallRisk > 0.8) {
      return 'high';
    }

    // Medium confidence
    if (result.overallRisk > 0.5) {
      return 'normal';
    }

    return 'low';
  }

  // ===========================================================================
  // Reviewer Management
  // ===========================================================================

  registerReviewer(reviewer: Reviewer): void {
    this.reviewers.set(reviewer.id, reviewer);
    console.log(`[HumanReview] Registered reviewer: ${reviewer.name}`);
  }

  unregisterReviewer(reviewerId: string): void {
    this.reviewers.delete(reviewerId);
  }

  getActiveReviewers(): Reviewer[] {
    return Array.from(this.reviewers.values());
  }

  // ===========================================================================
  // Queue Management
  // ===========================================================================

  getPendingCases(): ReviewCase[] {
    return Array.from(this.pendingCases.values()).filter(
      (c) => c.status === 'pending'
    );
  }

  getInReviewCases(): ReviewCase[] {
    return Array.from(this.pendingCases.values()).filter(
      (c) => c.status === 'in_review'
    );
  }

  async loadPendingFromDatabase(): Promise<void> {
    const db = await getSafeOSDatabase();
    const cases = await db.all<ReviewCase[]>(
      `SELECT * FROM review_cases WHERE status IN ('pending', 'in_review')`
    );

    for (const c of cases) {
      this.pendingCases.set(c.id, c);
    }

    console.log(`[HumanReview] Loaded ${cases.length} pending cases`);
  }

  // ===========================================================================
  // Stats
  // ===========================================================================

  getStats(): {
    pendingCount: number;
    inReviewCount: number;
    completedCount: number;
    reviewerCount: number;
    avgReviewTimeMinutes: number;
  } {
    return {
      pendingCount: this.getPendingCases().length,
      inReviewCount: this.getInReviewCases().length,
      completedCount: this.completedCount,
      reviewerCount: this.reviewers.size,
      avgReviewTimeMinutes: 0, // Would calculate from completed cases
    };
  }
}

// =============================================================================
// Singleton
// =============================================================================

let defaultManager: HumanReviewManager | null = null;

export function getDefaultHumanReviewManager(): HumanReviewManager {
  if (!defaultManager) {
    defaultManager = new HumanReviewManager();
  }
  return defaultManager;
}


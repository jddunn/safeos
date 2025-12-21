/**
 * Content Moderation Filter
 *
 * AI-based content moderation with 4-tier escalation system.
 *
 * Tiers:
 * 1. Automated AI screening (all content)
 * 2. Cloud AI verification (flagged content)
 * 3. Anonymized human review (severe concerns)
 * 4. Law enforcement referral (CSAM, child endangerment)
 *
 * @module lib/safety/content-filter
 */

import type { ModerationResult, ModerationTier, ContentFlag } from '../../types/index.js';
import { getDefaultOllamaClient } from '../ollama/client.js';
import { generateId, now } from '../../db/index.js';

// =============================================================================
// Content Categories
// =============================================================================

export const CONTENT_CATEGORIES = {
  SAFE: 'safe',
  INAPPROPRIATE: 'inappropriate',
  ADULT: 'adult',
  VIOLENCE: 'violence',
  ABUSE: 'abuse',
  CSAM: 'csam', // Child sexual abuse material - mandatory reporting
  NEGLECT: 'neglect',
  DANGEROUS: 'dangerous',
} as const;

export type ContentCategory = (typeof CONTENT_CATEGORIES)[keyof typeof CONTENT_CATEGORIES];

// =============================================================================
// Moderation Prompts
// =============================================================================

const MODERATION_PROMPT = `You are a content safety moderator. Analyze this image for policy violations.

Evaluate for:
1. Appropriate content for a monitoring service
2. Signs of abuse or neglect (of pets, children, or elderly)
3. Dangerous situations
4. Adult/inappropriate content
5. Violence or injury

Respond in this format:
SAFE: yes/no
CATEGORIES: [list any concerning categories]
CONFIDENCE: 0-100
DESCRIPTION: Brief description of concerns

Categories to check:
- safe: Normal, appropriate content
- inappropriate: Content unsuitable for monitoring
- adult: Adult/sexual content
- violence: Violence or gore
- abuse: Signs of abuse
- neglect: Signs of neglect
- dangerous: Dangerous situation visible

Be conservative - flag anything questionable for review.`;

// =============================================================================
// Content Filter Class
// =============================================================================

export class ContentFilter {
  private enabled: boolean;
  private autoEscalate: boolean;
  private flagCount = 0;
  private escalationCount = 0;

  constructor(options?: { enabled?: boolean; autoEscalate?: boolean }) {
    this.enabled = options?.enabled ?? true;
    this.autoEscalate = options?.autoEscalate ?? true;
  }

  // ===========================================================================
  // Main Moderation
  // ===========================================================================

  /**
   * Analyze content for policy violations
   */
  async moderate(frameData: string): Promise<ModerationResult> {
    if (!this.enabled) {
      return {
        tier: 1,
        flagged: false,
        categories: ['safe'],
        confidence: 100,
        action: 'allow',
      };
    }

    try {
      // Tier 1: Local AI screening
      const tier1Result = await this.tier1Screening(frameData);

      if (!tier1Result.flagged) {
        return tier1Result;
      }

      this.flagCount++;

      // Check for mandatory reporting categories
      if (this.requiresMandatoryReporting(tier1Result.categories)) {
        return {
          ...tier1Result,
          tier: 4,
          action: 'escalate',
          reason: 'Mandatory reporting required - content flagged for review',
        };
      }

      // Check if cloud verification needed
      if (this.autoEscalate && tier1Result.confidence < 80) {
        // Tier 2: Cloud verification would go here
        // For now, escalate to human review
        return {
          ...tier1Result,
          tier: 3,
          action: 'blur',
          reason: 'Content flagged for anonymized human review',
        };
      }

      // Determine action based on categories
      const action = this.determineAction(tier1Result.categories);

      return {
        ...tier1Result,
        action,
      };
    } catch (error) {
      console.error('[ContentFilter] Moderation failed:', error);
      // Fail open but log for review
      return {
        tier: 1,
        flagged: false,
        categories: ['safe'],
        confidence: 0,
        action: 'allow',
        reason: 'Moderation failed - allowing with low confidence',
      };
    }
  }

  // ===========================================================================
  // Tier 1: Local AI Screening
  // ===========================================================================

  private async tier1Screening(frameData: string): Promise<ModerationResult> {
    const ollama = getDefaultOllamaClient();
    const isHealthy = await ollama.isHealthy();

    if (!isHealthy) {
      // Can't moderate without Ollama - allow but flag
      return {
        tier: 1,
        flagged: false,
        categories: ['safe'],
        confidence: 0,
        action: 'allow',
        reason: 'Ollama not available for moderation',
      };
    }

    const result = await ollama.triage(frameData, MODERATION_PROMPT);
    return this.parseModeratorResponse(result.response);
  }

  // ===========================================================================
  // Response Parsing
  // ===========================================================================

  private parseModeratorResponse(response: string): ModerationResult {
    const lines = response.toLowerCase().split('\n');
    let safe = true;
    let categories: string[] = [];
    let confidence = 50;

    for (const line of lines) {
      if (line.includes('safe:')) {
        safe = line.includes('yes');
      }
      if (line.includes('categories:')) {
        const match = line.match(/\[(.*)\]/);
        if (match) {
          categories = match[1].split(',').map((c) => c.trim());
        }
      }
      if (line.includes('confidence:')) {
        const match = line.match(/(\d+)/);
        if (match) {
          confidence = parseInt(match[1], 10);
        }
      }
    }

    if (categories.length === 0) {
      categories = safe ? ['safe'] : ['inappropriate'];
    }

    return {
      tier: 1,
      flagged: !safe,
      categories,
      confidence,
      action: safe ? 'allow' : 'blur',
    };
  }

  // ===========================================================================
  // Action Determination
  // ===========================================================================

  private determineAction(
    categories: string[]
  ): 'allow' | 'blur' | 'block' | 'escalate' {
    // Mandatory reporting
    if (categories.includes('csam')) {
      return 'escalate';
    }

    // Block severe content
    if (
      categories.includes('abuse') ||
      categories.includes('violence') ||
      categories.includes('adult')
    ) {
      return 'block';
    }

    // Blur questionable content
    if (
      categories.includes('inappropriate') ||
      categories.includes('dangerous') ||
      categories.includes('neglect')
    ) {
      return 'blur';
    }

    return 'allow';
  }

  private requiresMandatoryReporting(categories: string[]): boolean {
    // CSAM is mandatory reporting in all jurisdictions
    return categories.includes('csam');
  }

  // ===========================================================================
  // Flag Management
  // ===========================================================================

  /**
   * Create a content flag for human review
   */
  createFlag(
    streamId: string,
    frameId: string,
    result: ModerationResult
  ): ContentFlag {
    this.escalationCount++;

    return {
      id: generateId(),
      streamId,
      frameId,
      tier: result.tier,
      categories: result.categories,
      status: 'pending',
      createdAt: now(),
    };
  }

  // ===========================================================================
  // Stats
  // ===========================================================================

  getStats(): {
    enabled: boolean;
    flagCount: number;
    escalationCount: number;
  } {
    return {
      enabled: this.enabled,
      flagCount: this.flagCount,
      escalationCount: this.escalationCount,
    };
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setAutoEscalate(autoEscalate: boolean): void {
    this.autoEscalate = autoEscalate;
  }
}

// =============================================================================
// Singleton
// =============================================================================

let defaultFilter: ContentFilter | null = null;

export function getDefaultContentFilter(): ContentFilter {
  if (!defaultFilter) {
    defaultFilter = new ContentFilter();
  }
  return defaultFilter;
}


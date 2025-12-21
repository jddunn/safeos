/**
 * Content Filter & Abuse Detection
 *
 * 4-tier content moderation system:
 * 1. Local AI screening (fast, cheap)
 * 2. Cloud AI verification (when needed)
 * 3. Automated flagging/action
 * 4. Human review queue (for edge cases)
 *
 * @module lib/safety/content-filter
 */

import type { ModerationTier, ModerationResult, ContentFlag, MonitoringScenario } from '../../types/index.js';
import { getDefaultOllamaClient, type OllamaClient } from '../ollama/client.js';
import { getSafeOSDatabase, generateId, now } from '../../db/index.js';

// =============================================================================
// Configuration
// =============================================================================

export interface ContentFilterConfig {
  enableLocalScreening: boolean;
  enableCloudVerification: boolean;
  autoBlockThreshold: number; // 0-1, auto-block if confidence above this
  humanReviewThreshold: number; // 0-1, require human review if above this
  blurThreshold: number; // 0-1, blur content if above this
  bannedCategories: ContentCategory[];
  maxFlagsBeforeBan: number;
  banDurationDays: number;
}

export type ContentCategory =
  | 'abuse'
  | 'neglect'
  | 'violence'
  | 'explicit'
  | 'gore'
  | 'self_harm'
  | 'animal_cruelty'
  | 'child_endangerment'
  | 'illegal_activity'
  | 'fraud';

const DEFAULT_CONFIG: ContentFilterConfig = {
  enableLocalScreening: true,
  enableCloudVerification: true,
  autoBlockThreshold: 0.9,
  humanReviewThreshold: 0.6,
  blurThreshold: 0.4,
  bannedCategories: [
    'abuse',
    'neglect',
    'violence',
    'explicit',
    'gore',
    'child_endangerment',
    'animal_cruelty',
  ],
  maxFlagsBeforeBan: 3,
  banDurationDays: 30,
};

// =============================================================================
// Types
// =============================================================================

export interface ContentAnalysis {
  isSafe: boolean;
  categories: DetectedCategory[];
  overallRisk: number;
  requiresHumanReview: boolean;
  action: 'allow' | 'blur' | 'block' | 'escalate';
  reasoning: string;
}

interface DetectedCategory {
  category: ContentCategory;
  confidence: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details?: string;
}

// =============================================================================
// Prompts
// =============================================================================

const MODERATION_PROMPT = `You are a content safety analyst for SafeOS, a humanitarian monitoring service used to watch over pets, babies, and elderly individuals.

Your job is to detect ABUSE, NEGLECT, VIOLENCE, or other concerning content that suggests someone is being harmed.

IMPORTANT CONTEXT:
- This service monitors to PROTECT vulnerable beings, not to enable abuse
- We must detect if a caregiver is NEGLECTING or HARMING those in their care
- False positives are better than missing actual abuse

Analyze this image and respond in JSON format:
{
  "is_safe": true/false,
  "categories": [
    {
      "category": "category_name",
      "confidence": 0.0-1.0,
      "severity": "low/medium/high/critical",
      "details": "description"
    }
  ],
  "overall_risk": 0.0-1.0,
  "reasoning": "brief explanation"
}

CATEGORY DEFINITIONS:
- abuse: Physical, emotional, or verbal abuse of person/animal
- neglect: Failure to provide basic needs (food, water, medical care)
- violence: Acts of violence or threats
- explicit: Sexual content (BLOCK immediately)
- gore: Graphic injury or death
- child_endangerment: Unsafe conditions for children
- animal_cruelty: Harm or neglect of animals
- self_harm: Signs of self-injury
- illegal_activity: Criminal behavior

IMPORTANT:
- Crying alone is NOT abuse (normal for babies)
- Pets alone is NOT neglect (normal)
- Elderly sleeping is NOT concerning
- Focus on ACTUAL harm or danger`;

// =============================================================================
// Content Filter
// =============================================================================

export class ContentFilter {
  private config: ContentFilterConfig;
  private ollama: OllamaClient;
  private analysisCount = 0;
  private flagCount = 0;
  private blockCount = 0;

  constructor(config?: Partial<ContentFilterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.ollama = getDefaultOllamaClient();
  }

  // ===========================================================================
  // Main Moderation
  // ===========================================================================

  /**
   * Moderate content through the 4-tier system
   */
  async moderate(
    frameBase64: string,
    streamId: string,
    scenario: MonitoringScenario
  ): Promise<ModerationResult> {
    this.analysisCount++;

    const startTime = Date.now();
    let result: ContentAnalysis;

    // Tier 1: Local AI screening
    if (this.config.enableLocalScreening) {
      try {
        result = await this.localScreening(frameBase64, scenario);
      } catch (error) {
        console.error('[ContentFilter] Local screening failed:', error);
        // Fail open - allow if local screening fails
        result = this.createSafeResult();
      }
    } else {
      result = this.createSafeResult();
    }

    // Tier 2: Cloud verification for uncertain cases
    if (
      this.config.enableCloudVerification &&
      result.overallRisk > this.config.blurThreshold &&
      result.overallRisk < this.config.autoBlockThreshold
    ) {
      try {
        const cloudResult = await this.cloudVerification(frameBase64, scenario);
        // Take the more severe of the two
        if (cloudResult.overallRisk > result.overallRisk) {
          result = cloudResult;
        }
      } catch (error) {
        console.error('[ContentFilter] Cloud verification failed:', error);
      }
    }

    // Determine action based on thresholds
    const action = this.determineAction(result);
    result.action = action;
    result.requiresHumanReview = action === 'escalate' || result.requiresHumanReview;

    // Tier 3: Create flag if needed
    if (action !== 'allow') {
      this.flagCount++;
      if (action === 'block') {
        this.blockCount++;
      }
      await this.createFlag(streamId, result, frameBase64);
    }

    const moderationResult: ModerationResult = {
      id: generateId(),
      streamId,
      timestamp: now(),
      processingTimeMs: Date.now() - startTime,
      tier: this.determineTier(action),
      action,
      isSafe: result.isSafe,
      categories: result.categories.map((c) => ({
        category: c.category,
        confidence: c.confidence,
        severity: c.severity,
      })),
      overallRisk: result.overallRisk,
      reasoning: result.reasoning,
      requiresHumanReview: result.requiresHumanReview,
    };

    return moderationResult;
  }

  // ===========================================================================
  // Tier 1: Local Screening
  // ===========================================================================

  private async localScreening(
    frameBase64: string,
    scenario: MonitoringScenario
  ): Promise<ContentAnalysis> {
    const contextPrompt = this.getScenarioContext(scenario);

    const response = await this.ollama.analyzeImage(
      frameBase64,
      `${MODERATION_PROMPT}\n\nCONTEXT: This is monitoring a ${scenario}.\n${contextPrompt}`
    );

    return this.parseAnalysisResponse(response);
  }

  // ===========================================================================
  // Tier 2: Cloud Verification
  // ===========================================================================

  private async cloudVerification(
    frameBase64: string,
    scenario: MonitoringScenario
  ): Promise<ContentAnalysis> {
    // In production, this would use Anthropic Claude or OpenAI GPT-4V
    // For now, we'll use Ollama with a more thorough model

    try {
      // Try LLaVA 13B for more accurate analysis
      const response = await this.ollama.generate(
        `${MODERATION_PROMPT}\n\nThis is a verification pass. Be thorough and consider all possibilities.`,
        'llava:13b',
        [frameBase64]
      );

      return this.parseAnalysisResponse(response);
    } catch {
      // Fall back to default model
      const response = await this.ollama.analyzeImage(frameBase64, MODERATION_PROMPT);
      return this.parseAnalysisResponse(response);
    }
  }

  // ===========================================================================
  // Tier 3: Flag Creation
  // ===========================================================================

  private async createFlag(
    streamId: string,
    analysis: ContentAnalysis,
    frameBase64: string
  ): Promise<ContentFlag> {
    const db = await getSafeOSDatabase();

    const flag: ContentFlag = {
      id: generateId(),
      streamId,
      flagType: analysis.action === 'block' ? 'critical' : 'warning',
      categories: analysis.categories.map((c) => c.category),
      confidence: analysis.overallRisk,
      severity:
        analysis.overallRisk > 0.8
          ? 'critical'
          : analysis.overallRisk > 0.6
            ? 'high'
            : analysis.overallRisk > 0.4
              ? 'medium'
              : 'low',
      status: analysis.requiresHumanReview ? 'pending_review' : 'auto_actioned',
      action: analysis.action,
      reasoning: analysis.reasoning,
      frameHash: this.hashFrame(frameBase64),
      createdAt: now(),
      reviewedAt: null,
      reviewedBy: null,
      reviewNotes: null,
    };

    // Store in database (frame stored separately for privacy)
    await db.run(
      `INSERT INTO content_flags (
        id, stream_id, flag_type, categories, confidence, severity,
        status, action_taken, reasoning, frame_hash, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        flag.id,
        flag.streamId,
        flag.flagType,
        JSON.stringify(flag.categories),
        flag.confidence,
        flag.severity,
        flag.status,
        flag.action,
        flag.reasoning,
        flag.frameHash,
        flag.createdAt,
      ]
    );

    console.log(
      `[ContentFilter] Created flag ${flag.id} for stream ${streamId}: ${flag.action}`
    );

    return flag;
  }

  // ===========================================================================
  // Response Parsing
  // ===========================================================================

  private parseAnalysisResponse(response: string): ContentAnalysis {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.createSafeResult();
      }

      const parsed = JSON.parse(jsonMatch[0]);

      const categories: DetectedCategory[] = (parsed.categories || []).map(
        (c: { category: string; confidence?: number; severity?: string; details?: string }) => ({
          category: c.category as ContentCategory,
          confidence: c.confidence || 0,
          severity: c.severity || 'low',
          details: c.details,
        })
      );

      return {
        isSafe: parsed.is_safe ?? true,
        categories,
        overallRisk: parsed.overall_risk || 0,
        requiresHumanReview: false,
        action: 'allow',
        reasoning: parsed.reasoning || 'No concerns detected',
      };
    } catch (error) {
      console.error('[ContentFilter] Failed to parse response:', error);
      return this.createSafeResult();
    }
  }

  private createSafeResult(): ContentAnalysis {
    return {
      isSafe: true,
      categories: [],
      overallRisk: 0,
      requiresHumanReview: false,
      action: 'allow',
      reasoning: 'Content appears safe',
    };
  }

  // ===========================================================================
  // Action Determination
  // ===========================================================================

  private determineAction(
    analysis: ContentAnalysis
  ): 'allow' | 'blur' | 'block' | 'escalate' {
    // Check for banned categories with high confidence
    const hasBannedCategory = analysis.categories.some(
      (c) =>
        this.config.bannedCategories.includes(c.category) &&
        c.confidence > this.config.blurThreshold
    );

    // Critical categories always escalate
    const hasCritical = analysis.categories.some(
      (c) =>
        ['child_endangerment', 'explicit', 'gore'].includes(c.category) &&
        c.confidence > 0.5
    );

    if (hasCritical || analysis.overallRisk >= this.config.autoBlockThreshold) {
      return 'block';
    }

    if (analysis.overallRisk >= this.config.humanReviewThreshold) {
      return 'escalate';
    }

    if (hasBannedCategory || analysis.overallRisk >= this.config.blurThreshold) {
      return 'blur';
    }

    return 'allow';
  }

  private determineTier(action: 'allow' | 'blur' | 'block' | 'escalate'): ModerationTier {
    switch (action) {
      case 'allow':
        return 'local_ai';
      case 'blur':
        return 'local_ai';
      case 'block':
        return 'automated_action';
      case 'escalate':
        return 'human_review';
    }
  }

  // ===========================================================================
  // Utilities
  // ===========================================================================

  private getScenarioContext(scenario: MonitoringScenario): string {
    switch (scenario) {
      case 'baby':
        return `Normal baby behaviors: sleeping, crying, playing, crawling.
Concerning: unsupervised near hazards, left alone for extended periods, visible injuries.`;
      case 'pet':
        return `Normal pet behaviors: sleeping, eating, playing, barking/meowing.
Concerning: visible injuries, distress, unsafe environment, no food/water.`;
      case 'elderly':
        return `Normal elderly behaviors: sleeping, sitting, walking slowly.
Concerning: fallen and unable to get up, signs of confusion, injuries.`;
    }
  }

  private hashFrame(base64: string): string {
    // Simple hash for frame identification (not cryptographic)
    let hash = 0;
    for (let i = 0; i < Math.min(base64.length, 1000); i++) {
      const char = base64.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  updateConfig(config: Partial<ContentFilterConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): ContentFilterConfig {
    return { ...this.config };
  }

  // ===========================================================================
  // Stats
  // ===========================================================================

  getStats(): {
    analysisCount: number;
    flagCount: number;
    blockCount: number;
    flagRate: number;
    blockRate: number;
  } {
    return {
      analysisCount: this.analysisCount,
      flagCount: this.flagCount,
      blockCount: this.blockCount,
      flagRate: this.analysisCount > 0 ? this.flagCount / this.analysisCount : 0,
      blockRate: this.analysisCount > 0 ? this.blockCount / this.analysisCount : 0,
    };
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

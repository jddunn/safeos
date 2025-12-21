/**
 * Cloud LLM Fallback
 *
 * Multi-provider fallback chain for vision analysis when local
 * Ollama is unavailable, too slow, or needs verification.
 *
 * Priority: Anthropic → OpenAI → OpenRouter
 *
 * @module lib/analysis/cloud-fallback
 */

import type { ConcernLevel, MonitoringScenario, AnalysisResult } from '../../types/index.js';
import { generateId, now } from '../../db/index.js';

// =============================================================================
// Configuration
// =============================================================================

export interface CloudFallbackConfig {
  anthropicApiKey: string | null;
  openaiApiKey: string | null;
  openrouterApiKey: string | null;
  timeout: number;
  maxRetries: number;
  preferredProvider: 'anthropic' | 'openai' | 'openrouter' | 'auto';
}

const DEFAULT_CONFIG: CloudFallbackConfig = {
  anthropicApiKey: process.env['ANTHROPIC_API_KEY'] || null,
  openaiApiKey: process.env['OPENAI_API_KEY'] || null,
  openrouterApiKey: process.env['OPENROUTER_API_KEY'] || null,
  timeout: 30000,
  maxRetries: 2,
  preferredProvider: 'auto',
};

// =============================================================================
// Provider Types
// =============================================================================

type Provider = 'anthropic' | 'openai' | 'openrouter';

interface ProviderConfig {
  apiKey: string;
  endpoint: string;
  model: string;
  headers: Record<string, string>;
}

// =============================================================================
// Prompts
// =============================================================================

const ANALYSIS_PROMPTS: Record<MonitoringScenario, string> = {
  pet: `Analyze this image of a pet monitoring camera. Assess the pet's wellbeing and safety.

Check for:
- Is the pet in distress, injured, or unwell?
- Is the pet in an unsafe situation?
- Any signs of distress (panting excessively, hiding, not moving)?
- Has there been an accident that needs cleanup?
- Is food/water available if visible?

Respond with JSON:
{
  "concern_level": "none|low|medium|high|critical",
  "confidence": 0.0-1.0,
  "description": "brief description of what you observe",
  "detected_issues": ["list", "of", "concerns"],
  "recommended_action": "what should be done if anything"
}`,

  baby: `Analyze this image from a baby/child monitoring camera. Prioritize safety assessment.

Check for:
- Is the baby/child in a safe position?
- Any signs of distress, crying, or discomfort?
- Any hazards visible (cords, small objects, climbing)?
- Is the child in an unsafe location?
- Any signs of injury or illness?

Respond with JSON:
{
  "concern_level": "none|low|medium|high|critical",
  "confidence": 0.0-1.0,
  "description": "brief description of what you observe",
  "detected_issues": ["list", "of", "concerns"],
  "recommended_action": "what should be done if anything"
}

CRITICAL: If the child appears to be in immediate danger, concern_level must be "critical".`,

  elderly: `Analyze this image from an elderly care monitoring camera. Focus on safety and wellbeing.

Check for:
- Has the person fallen or is in distress?
- Signs of confusion or disorientation?
- Any mobility issues or unsafe movement?
- Extended inactivity that could indicate a problem?
- Signs of medical distress?

Respond with JSON:
{
  "concern_level": "none|low|medium|high|critical",
  "confidence": 0.0-1.0,
  "description": "brief description of what you observe",
  "detected_issues": ["list", "of", "concerns"],
  "recommended_action": "what should be done if anything"
}

CRITICAL: Falls in elderly individuals require immediate attention - if a fall is suspected, concern_level must be "critical".`,
};

// =============================================================================
// Cloud Fallback Service
// =============================================================================

export class CloudFallbackService {
  private config: CloudFallbackConfig;
  private requestCount = 0;
  private failureCount = 0;
  private lastProvider: Provider | null = null;

  constructor(config?: Partial<CloudFallbackConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===========================================================================
  // Main Analysis
  // ===========================================================================

  /**
   * Analyze frame using cloud LLM providers
   */
  async analyze(
    frameBase64: string,
    scenario: MonitoringScenario
  ): Promise<AnalysisResult> {
    this.requestCount++;
    const startTime = Date.now();

    const providers = this.getProviderOrder();

    for (const provider of providers) {
      const config = this.getProviderConfig(provider);
      if (!config) continue;

      try {
        const response = await this.callProvider(
          provider,
          config,
          frameBase64,
          ANALYSIS_PROMPTS[scenario]
        );

        const parsed = this.parseResponse(response);
        this.lastProvider = provider;

        return {
          id: generateId(),
          streamId: '',
          frameId: '',
          timestamp: now(),
          concernLevel: parsed.concernLevel,
          confidence: parsed.confidence,
          description: parsed.description,
          detectedIssues: parsed.detectedIssues,
          recommendedAction: parsed.recommendedAction,
          processingTimeMs: Date.now() - startTime,
          model: config.model,
          isCloudFallback: true,
          triageResult: null,
        };
      } catch (error) {
        console.error(`[CloudFallback] ${provider} failed:`, error);
        this.failureCount++;
        continue;
      }
    }

    // All providers failed
    throw new Error('All cloud providers failed');
  }

  // ===========================================================================
  // Provider Configuration
  // ===========================================================================

  private getProviderOrder(): Provider[] {
    if (this.config.preferredProvider !== 'auto') {
      const preferred = this.config.preferredProvider;
      const others: Provider[] = ['anthropic', 'openai', 'openrouter'].filter(
        (p) => p !== preferred
      ) as Provider[];
      return [preferred, ...others];
    }

    // Auto order: Anthropic (best quality) → OpenAI → OpenRouter (cheapest)
    return ['anthropic', 'openai', 'openrouter'];
  }

  private getProviderConfig(provider: Provider): ProviderConfig | null {
    switch (provider) {
      case 'anthropic':
        if (!this.config.anthropicApiKey) return null;
        return {
          apiKey: this.config.anthropicApiKey,
          endpoint: 'https://api.anthropic.com/v1/messages',
          model: 'claude-3-5-sonnet-20241022',
          headers: {
            'anthropic-version': '2023-06-01',
            'x-api-key': this.config.anthropicApiKey,
          },
        };

      case 'openai':
        if (!this.config.openaiApiKey) return null;
        return {
          apiKey: this.config.openaiApiKey,
          endpoint: 'https://api.openai.com/v1/chat/completions',
          model: 'gpt-4o',
          headers: {
            Authorization: `Bearer ${this.config.openaiApiKey}`,
          },
        };

      case 'openrouter':
        if (!this.config.openrouterApiKey) return null;
        return {
          apiKey: this.config.openrouterApiKey,
          endpoint: 'https://openrouter.ai/api/v1/chat/completions',
          model: 'anthropic/claude-3-haiku',
          headers: {
            Authorization: `Bearer ${this.config.openrouterApiKey}`,
            'HTTP-Referer': 'https://safeos.app',
            'X-Title': 'SafeOS',
          },
        };
    }
  }

  // ===========================================================================
  // Provider Calls
  // ===========================================================================

  private async callProvider(
    provider: Provider,
    config: ProviderConfig,
    frameBase64: string,
    prompt: string
  ): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      let body: string;

      if (provider === 'anthropic') {
        body = JSON.stringify({
          model: config.model,
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/jpeg',
                    data: frameBase64.replace(/^data:image\/[a-z]+;base64,/, ''),
                  },
                },
                {
                  type: 'text',
                  text: prompt,
                },
              ],
            },
          ],
        });
      } else {
        // OpenAI / OpenRouter format
        body = JSON.stringify({
          model: config.model,
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: frameBase64.startsWith('data:')
                      ? frameBase64
                      : `data:image/jpeg;base64,${frameBase64}`,
                  },
                },
                {
                  type: 'text',
                  text: prompt,
                },
              ],
            },
          ],
        });
      }

      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers,
        },
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`${provider} API error: ${response.status} - ${error}`);
      }

      const data = await response.json();

      // Extract text from response
      if (provider === 'anthropic') {
        return data.content[0].text;
      } else {
        return data.choices[0].message.content;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ===========================================================================
  // Response Parsing
  // ===========================================================================

  private parseResponse(response: string): {
    concernLevel: ConcernLevel;
    confidence: number;
    description: string;
    detectedIssues: string[];
    recommendedAction: string | null;
  } {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.createDefaultResponse('Could not parse response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Map concern_level to our enum
      const concernLevel = this.mapConcernLevel(parsed.concern_level);

      return {
        concernLevel,
        confidence: parsed.confidence || 0.5,
        description: parsed.description || 'Analysis complete',
        detectedIssues: parsed.detected_issues || [],
        recommendedAction: parsed.recommended_action || null,
      };
    } catch (error) {
      console.error('[CloudFallback] Failed to parse response:', error);
      return this.createDefaultResponse('Parse error');
    }
  }

  private mapConcernLevel(level: string): ConcernLevel {
    const normalized = level?.toLowerCase()?.trim();
    switch (normalized) {
      case 'none':
        return 'none';
      case 'low':
        return 'low';
      case 'medium':
        return 'medium';
      case 'high':
        return 'high';
      case 'critical':
        return 'critical';
      default:
        return 'low';
    }
  }

  private createDefaultResponse(description: string): {
    concernLevel: ConcernLevel;
    confidence: number;
    description: string;
    detectedIssues: string[];
    recommendedAction: string | null;
  } {
    return {
      concernLevel: 'none',
      confidence: 0.5,
      description,
      detectedIssues: [],
      recommendedAction: null,
    };
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  updateConfig(config: Partial<CloudFallbackConfig>): void {
    this.config = { ...this.config, ...config };
  }

  isAvailable(): boolean {
    return !!(
      this.config.anthropicApiKey ||
      this.config.openaiApiKey ||
      this.config.openrouterApiKey
    );
  }

  getAvailableProviders(): Provider[] {
    const available: Provider[] = [];
    if (this.config.anthropicApiKey) available.push('anthropic');
    if (this.config.openaiApiKey) available.push('openai');
    if (this.config.openrouterApiKey) available.push('openrouter');
    return available;
  }

  // ===========================================================================
  // Stats
  // ===========================================================================

  getStats(): {
    requestCount: number;
    failureCount: number;
    successRate: number;
    lastProvider: Provider | null;
    availableProviders: Provider[];
  } {
    return {
      requestCount: this.requestCount,
      failureCount: this.failureCount,
      successRate:
        this.requestCount > 0
          ? (this.requestCount - this.failureCount) / this.requestCount
          : 1,
      lastProvider: this.lastProvider,
      availableProviders: this.getAvailableProviders(),
    };
  }
}

// =============================================================================
// Singleton
// =============================================================================

let defaultService: CloudFallbackService | null = null;

export function getDefaultCloudFallback(): CloudFallbackService {
  if (!defaultService) {
    defaultService = new CloudFallbackService();
  }
  return defaultService;
}

/**
 * Quick function for cloud analysis
 */
export async function cloudFallbackAnalysis(
  frameBase64: string,
  scenario: MonitoringScenario
): Promise<AnalysisResult> {
  return getDefaultCloudFallback().analyze(frameBase64, scenario);
}

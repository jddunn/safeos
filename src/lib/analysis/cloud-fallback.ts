/**
 * Cloud Fallback for Vision Analysis
 *
 * Integrates with OpenRouter, OpenAI, and Anthropic for cloud-based
 * vision analysis when local Ollama fails or is uncertain.
 *
 * Fallback chain: OpenRouter → OpenAI → Anthropic
 *
 * @module lib/analysis/cloud-fallback
 */

import type { ConcernLevel, MonitoringScenario } from '../../types/index.js';
import { getPetPrompt, getBabyPrompt, getElderlyPrompt } from './profiles/index.js';

// =============================================================================
// Configuration
// =============================================================================

export interface CloudConfig {
  openRouterKey?: string;
  openAIKey?: string;
  anthropicKey?: string;
  preferredProvider?: 'openrouter' | 'openai' | 'anthropic';
  maxRetries?: number;
  timeout?: number;
}

const DEFAULT_CONFIG: CloudConfig = {
  openRouterKey: process.env['OPENROUTER_API_KEY'],
  openAIKey: process.env['OPENAI_API_KEY'],
  anthropicKey: process.env['ANTHROPIC_API_KEY'],
  preferredProvider: 'openrouter',
  maxRetries: 2,
  timeout: 30000,
};

// =============================================================================
// Provider Implementations
// =============================================================================

async function callOpenRouter(
  imageBase64: string,
  prompt: string,
  config: CloudConfig
): Promise<string> {
  if (!config.openRouterKey) {
    throw new Error('OpenRouter API key not configured');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openRouterKey}`,
      'HTTP-Referer': 'https://safeos.supercloud.dev',
      'X-Title': 'SafeOS Guardian',
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: imageBase64.startsWith('data:')
                  ? imageBase64
                  : `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 512,
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(config.timeout || 30000),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter failed: ${response.statusText}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  return data.choices[0]?.message?.content || '';
}

async function callOpenAI(
  imageBase64: string,
  prompt: string,
  config: CloudConfig
): Promise<string> {
  if (!config.openAIKey) {
    throw new Error('OpenAI API key not configured');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openAIKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: imageBase64.startsWith('data:')
                  ? imageBase64
                  : `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 512,
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(config.timeout || 30000),
  });

  if (!response.ok) {
    throw new Error(`OpenAI failed: ${response.statusText}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  return data.choices[0]?.message?.content || '';
}

async function callAnthropic(
  imageBase64: string,
  prompt: string,
  config: CloudConfig
): Promise<string> {
  if (!config.anthropicKey) {
    throw new Error('Anthropic API key not configured');
  }

  // Clean base64 for Anthropic format
  const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: cleanBase64,
              },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(config.timeout || 30000),
  });

  if (!response.ok) {
    throw new Error(`Anthropic failed: ${response.statusText}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
  };

  const textContent = data.content.find((c) => c.type === 'text');
  return textContent?.text || '';
}

// =============================================================================
// Cloud Fallback Service
// =============================================================================

export class CloudFallbackService {
  private config: CloudConfig;
  private callCount = 0;
  private errorCount = 0;

  constructor(config?: Partial<CloudConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if cloud fallback is available
   */
  isAvailable(): boolean {
    return !!(
      this.config.openRouterKey ||
      this.config.openAIKey ||
      this.config.anthropicKey
    );
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): string[] {
    const providers: string[] = [];
    if (this.config.openRouterKey) providers.push('openrouter');
    if (this.config.openAIKey) providers.push('openai');
    if (this.config.anthropicKey) providers.push('anthropic');
    return providers;
  }

  /**
   * Analyze an image using cloud providers
   */
  async analyze(
    imageBase64: string,
    scenario: MonitoringScenario
  ): Promise<{
    response: string;
    concernLevel: ConcernLevel;
    provider: string;
    latencyMs: number;
  }> {
    const prompt = this.getPrompt(scenario);
    const providers = this.getProviderChain();

    if (providers.length === 0) {
      throw new Error('No cloud providers configured');
    }

    let lastError: Error | null = null;

    for (const provider of providers) {
      const startTime = Date.now();

      try {
        this.callCount++;
        const response = await this.callProvider(provider, imageBase64, prompt);
        const concernLevel = this.parseConcernLevel(response);

        return {
          response,
          concernLevel,
          provider,
          latencyMs: Date.now() - startTime,
        };
      } catch (error) {
        this.errorCount++;
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`[CloudFallback] ${provider} failed:`, lastError.message);
        // Try next provider
      }
    }

    throw lastError || new Error('All cloud providers failed');
  }

  /**
   * Get the provider chain based on configuration
   */
  private getProviderChain(): string[] {
    const available = this.getAvailableProviders();
    const preferred = this.config.preferredProvider;

    if (preferred && available.includes(preferred)) {
      // Put preferred provider first
      return [preferred, ...available.filter((p) => p !== preferred)];
    }

    return available;
  }

  /**
   * Call a specific provider
   */
  private async callProvider(
    provider: string,
    imageBase64: string,
    prompt: string
  ): Promise<string> {
    switch (provider) {
      case 'openrouter':
        return callOpenRouter(imageBase64, prompt, this.config);
      case 'openai':
        return callOpenAI(imageBase64, prompt, this.config);
      case 'anthropic':
        return callAnthropic(imageBase64, prompt, this.config);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Get the appropriate prompt for a scenario
   */
  private getPrompt(scenario: MonitoringScenario): string {
    switch (scenario) {
      case 'pet':
        return getPetPrompt('detailed');
      case 'baby':
        return getBabyPrompt('detailed');
      case 'elderly':
        return getElderlyPrompt('detailed');
      default:
        return getPetPrompt('detailed');
    }
  }

  /**
   * Parse concern level from response
   */
  private parseConcernLevel(response: string): ConcernLevel {
    const lower = response.toLowerCase();

    if (lower.includes('critical') || lower.includes('emergency')) {
      return 'critical';
    }
    if (lower.includes('high') || lower.includes('urgent') || lower.includes('danger')) {
      return 'high';
    }
    if (lower.includes('medium') || lower.includes('moderate')) {
      return 'medium';
    }
    if (lower.includes('low') || lower.includes('minor')) {
      return 'low';
    }
    if (lower.includes('no concern') || lower.includes('normal') || lower.includes('safe')) {
      return 'none';
    }

    return 'low';
  }

  /**
   * Get statistics
   */
  getStats(): {
    available: boolean;
    providers: string[];
    callCount: number;
    errorCount: number;
    errorRate: number;
  } {
    return {
      available: this.isAvailable(),
      providers: this.getAvailableProviders(),
      callCount: this.callCount,
      errorCount: this.errorCount,
      errorRate: this.callCount > 0 ? this.errorCount / this.callCount : 0,
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


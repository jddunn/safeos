/**
 * Ollama Client
 *
 * HTTP client for local Ollama inference server.
 * Supports health checks, model management, and vision analysis.
 *
 * @module lib/ollama/client
 */

import type {
  OllamaModelInfo,
  OllamaGenerateRequest,
  OllamaGenerateResponse,
} from '../../types/index.js';

// =============================================================================
// Configuration
// =============================================================================

export interface OllamaClientConfig {
  host: string;
  timeout: number;
  triageModel: string;
  analysisModel: string;
}

const DEFAULT_CONFIG: OllamaClientConfig = {
  host: process.env['OLLAMA_HOST'] || 'http://localhost:11434',
  timeout: 120000, // 2 minutes for vision models
  triageModel: process.env['OLLAMA_TRIAGE_MODEL'] || 'moondream',
  analysisModel: process.env['OLLAMA_ANALYSIS_MODEL'] || 'llava:7b',
};

// =============================================================================
// Ollama Client Class
// =============================================================================

export class OllamaClient {
  private config: OllamaClientConfig;
  private healthCache: { healthy: boolean; checkedAt: number } | null = null;
  private modelCache: Map<string, OllamaModelInfo> = new Map();

  constructor(config: Partial<OllamaClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===========================================================================
  // Health & Status
  // ===========================================================================

  /**
   * Check if Ollama server is healthy and responding
   */
  async isHealthy(force = false): Promise<boolean> {
    // Use cached result if recent (within 30 seconds)
    if (!force && this.healthCache && Date.now() - this.healthCache.checkedAt < 30000) {
      return this.healthCache.healthy;
    }

    try {
      const response = await fetch(`${this.config.host}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      const healthy = response.ok;
      this.healthCache = { healthy, checkedAt: Date.now() };
      return healthy;
    } catch {
      this.healthCache = { healthy: false, checkedAt: Date.now() };
      return false;
    }
  }

  /**
   * Get server version info
   */
  async getVersion(): Promise<string | null> {
    try {
      const response = await fetch(`${this.config.host}/api/version`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) return null;
      const data = (await response.json()) as { version: string };
      return data.version;
    } catch {
      return null;
    }
  }

  // ===========================================================================
  // Model Management
  // ===========================================================================

  /**
   * List all available models
   */
  async listModels(): Promise<OllamaModelInfo[]> {
    const response = await fetch(`${this.config.host}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.statusText}`);
    }

    const data = (await response.json()) as { models: OllamaModelInfo[] };
    
    // Update cache
    this.modelCache.clear();
    for (const model of data.models) {
      this.modelCache.set(model.name, model);
    }

    return data.models;
  }

  /**
   * Check if a specific model is available
   */
  async hasModel(modelName: string): Promise<boolean> {
    if (this.modelCache.has(modelName)) {
      return true;
    }

    try {
      await this.listModels();
      return this.modelCache.has(modelName);
    } catch {
      return false;
    }
  }

  /**
   * Ensure required models are available
   */
  async ensureModels(): Promise<{
    triageReady: boolean;
    analysisReady: boolean;
    missing: string[];
  }> {
    const models = await this.listModels();
    const modelNames = new Set(models.map((m) => m.name));

    const triageReady = modelNames.has(this.config.triageModel);
    const analysisReady = modelNames.has(this.config.analysisModel);

    const missing: string[] = [];
    if (!triageReady) missing.push(this.config.triageModel);
    if (!analysisReady) missing.push(this.config.analysisModel);

    return { triageReady, analysisReady, missing };
  }

  /**
   * Pull a model (starts download)
   */
  async pullModel(modelName: string): Promise<void> {
    const response = await fetch(`${this.config.host}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: false }),
      signal: AbortSignal.timeout(3600000), // 1 hour for large models
    });

    if (!response.ok) {
      throw new Error(`Failed to pull model ${modelName}: ${response.statusText}`);
    }
  }

  // ===========================================================================
  // Generation
  // ===========================================================================

  /**
   * Generate a response from a model
   */
  async generate(request: OllamaGenerateRequest): Promise<OllamaGenerateResponse> {
    const startTime = Date.now();

    const response = await fetch(`${this.config.host}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...request,
        stream: false,
      }),
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      throw new Error(`Ollama generate failed: ${response.statusText}`);
    }

    const result = (await response.json()) as OllamaGenerateResponse;
    
    console.log(
      `[Ollama] Generated response in ${Date.now() - startTime}ms using ${request.model}`
    );

    return result;
  }

  /**
   * Analyze an image with a vision model
   */
  async analyzeImage(
    imageBase64: string,
    prompt: string,
    model?: string
  ): Promise<{ response: string; inferenceMs: number }> {
    const startTime = Date.now();
    const modelToUse = model || this.config.analysisModel;

    // Remove data URL prefix if present
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    const result = await this.generate({
      model: modelToUse,
      prompt,
      images: [cleanBase64],
      options: {
        temperature: 0.3,
        num_predict: 512,
      },
    });

    return {
      response: result.response,
      inferenceMs: Date.now() - startTime,
    };
  }

  /**
   * Quick triage analysis (uses faster model)
   */
  async triage(imageBase64: string, prompt: string): Promise<{
    response: string;
    inferenceMs: number;
  }> {
    return this.analyzeImage(imageBase64, prompt, this.config.triageModel);
  }

  /**
   * Detailed analysis (uses more capable model)
   */
  async analyze(imageBase64: string, prompt: string): Promise<{
    response: string;
    inferenceMs: number;
  }> {
    return this.analyzeImage(imageBase64, prompt, this.config.analysisModel);
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  getConfig(): OllamaClientConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<OllamaClientConfig>): void {
    this.config = { ...this.config, ...updates };
    this.healthCache = null; // Invalidate health cache on config change
  }
}

// =============================================================================
// Singleton & Factory
// =============================================================================

let defaultClient: OllamaClient | null = null;

export function createOllamaClient(config?: Partial<OllamaClientConfig>): OllamaClient {
  return new OllamaClient(config);
}

export function getDefaultOllamaClient(): OllamaClient {
  if (!defaultClient) {
    defaultClient = new OllamaClient();
  }
  return defaultClient;
}


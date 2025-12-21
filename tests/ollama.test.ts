/**
 * Ollama Client Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OllamaClient, createOllamaClient } from '../src/lib/ollama/client.js';

describe('OllamaClient', () => {
  let client: OllamaClient;

  beforeEach(() => {
    client = createOllamaClient({
      host: 'http://localhost:11434',
      timeout: 5000,
      triageModel: 'moondream',
      analysisModel: 'llava:7b',
    });
  });

  describe('configuration', () => {
    it('should use default configuration', () => {
      const config = client.getConfig();
      expect(config.host).toBe('http://localhost:11434');
      expect(config.triageModel).toBe('moondream');
      expect(config.analysisModel).toBe('llava:7b');
    });

    it('should allow configuration updates', () => {
      client.updateConfig({ timeout: 60000 });
      const config = client.getConfig();
      expect(config.timeout).toBe(60000);
    });
  });

  describe('health check', () => {
    it('should return false when Ollama is not running', async () => {
      // Mock fetch to simulate Ollama not running
      vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Connection refused'));
      
      const healthy = await client.isHealthy(true);
      expect(healthy).toBe(false);
    });

    it('should cache health check results', async () => {
      // First call
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [] }),
      } as Response);
      
      await client.isHealthy(true);
      
      // Second call should use cache
      const fetchSpy = vi.spyOn(global, 'fetch');
      await client.isHealthy(false);
      
      // fetch should not be called again (cached)
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('model management', () => {
    it('should check for required models', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [
            { name: 'moondream', size: 830000000 },
            { name: 'llava:7b', size: 4500000000 },
          ],
        }),
      } as Response);

      const result = await client.ensureModels();
      expect(result.triageReady).toBe(true);
      expect(result.analysisReady).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should report missing models', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [{ name: 'other-model', size: 1000000000 }],
        }),
      } as Response);

      const result = await client.ensureModels();
      expect(result.triageReady).toBe(false);
      expect(result.analysisReady).toBe(false);
      expect(result.missing).toContain('moondream');
      expect(result.missing).toContain('llava:7b');
    });
  });
});


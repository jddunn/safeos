/**
 * Ollama Client Unit Tests
 *
 * Tests for local LLM inference via Ollama.
 *
 * @module tests/unit/ollama-client
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mocking
import { OllamaClient } from '../../src/lib/ollama/client.js';

// =============================================================================
// Test Suite
// =============================================================================

describe('OllamaClient', () => {
  let client: OllamaClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new OllamaClient('http://localhost:11434');
  });

  // ===========================================================================
  // Health Check Tests
  // ===========================================================================

  describe('isHealthy', () => {
    it('should return true when Ollama is running', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [] }),
      });

      const healthy = await client.isHealthy();

      expect(healthy).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('should return false when Ollama is not running', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const healthy = await client.isHealthy();

      expect(healthy).toBe(false);
    });

    it('should return false on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const healthy = await client.isHealthy();

      expect(healthy).toBe(false);
    });

    it('should cache health check results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [] }),
      });

      await client.isHealthy();
      await client.isHealthy();

      // Should only be called once due to caching
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // Version Tests
  // ===========================================================================

  describe('getVersion', () => {
    it('should return version string', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ version: '0.3.6' }),
      });

      const version = await client.getVersion();

      expect(version).toBe('0.3.6');
    });

    it('should return null on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const version = await client.getVersion();

      expect(version).toBeNull();
    });
  });

  // ===========================================================================
  // Model Listing Tests
  // ===========================================================================

  describe('listModels', () => {
    it('should list available models', async () => {
      const mockModels = [
        { name: 'moondream:latest', size: 1_000_000_000, modified_at: '2024-01-01', digest: 'abc' },
        { name: 'llava:7b', size: 4_000_000_000, modified_at: '2024-01-01', digest: 'def' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: mockModels }),
      });

      const models = await client.listModels();

      expect(models).toHaveLength(2);
      expect(models[0].name).toBe('moondream:latest');
      expect(models[1].name).toBe('llava:7b');
    });

    it('should return empty array on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const models = await client.listModels();

      expect(models).toEqual([]);
    });
  });

  // ===========================================================================
  // Model Check Tests
  // ===========================================================================

  describe('hasModel', () => {
    it('should return true if model exists', async () => {
      const mockModels = [
        { name: 'moondream:latest', size: 1_000_000_000, modified_at: '2024-01-01', digest: 'abc' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: mockModels }),
      });

      const has = await client.hasModel('moondream');

      expect(has).toBe(true);
    });

    it('should return false if model does not exist', async () => {
      const mockModels = [
        { name: 'llava:7b', size: 4_000_000_000, modified_at: '2024-01-01', digest: 'abc' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: mockModels }),
      });

      const has = await client.hasModel('moondream');

      expect(has).toBe(false);
    });

    it('should cache model check results', async () => {
      const mockModels = [
        { name: 'moondream:latest', size: 1_000_000_000, modified_at: '2024-01-01', digest: 'abc' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: mockModels }),
      });

      await client.hasModel('moondream');
      await client.hasModel('moondream');

      // Should only fetch once due to caching
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // Generation Tests
  // ===========================================================================

  describe('generate', () => {
    it('should generate text response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: 'This is a test response.',
          done: true,
          total_duration: 1000000000,
        }),
      });

      const response = await client.generate({
        model: 'llama2:7b',
        prompt: 'Hello, world!',
      });

      // generate() returns just the string response
      expect(response).toBe('This is a test response.');
    });

    it('should include images in request for vision models', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: 'I see a cat.',
          done: true,
        }),
      });

      const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      await client.generate({
        model: 'llava:7b',
        prompt: 'What do you see?',
        images: [base64Image],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          body: expect.stringContaining('images'),
        })
      );
    });

    it('should throw on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(
        client.generate({
          model: 'llama2:7b',
          prompt: 'Hello',
        })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // Image Analysis Tests
  // ===========================================================================

  describe('analyzeImage', () => {
    it('should analyze image with vision model', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: 'The image shows a sleeping cat on a couch.',
          done: true,
        }),
      });

      const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const result = await client.analyzeImage(base64Image, 'Describe this image.');

      expect(result).toBe('The image shows a sleeping cat on a couch.');
    });

    it('should strip data URL prefix from images', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: 'An image.',
          done: true,
        }),
      });

      const dataUrl = 'data:image/png;base64,iVBORw0KGgo...';

      await client.analyzeImage(dataUrl, 'Describe');

      // Should not include the data URL prefix in the request
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          body: expect.not.stringContaining('data:image'),
        })
      );
    });
  });

  // ===========================================================================
  // Triage Tests
  // ===========================================================================

  describe('triage', () => {
    it('should return string response from triage model', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: 'CONCERN: low - Everything appears normal.',
          done: true,
        }),
      });

      const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const result = await client.triage(base64Image, 'Check this pet.');

      // triage() returns string, not structured object
      expect(result).toBe('CONCERN: low - Everything appears normal.');
    });
  });

  // ===========================================================================
  // Analysis Tests  
  // ===========================================================================

  describe('analyze', () => {
    it('should use larger analysis model', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: 'Detailed analysis...',
          done: true,
        }),
      });

      const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      await client.analyze(base64Image, 'Analyze in detail.');

      // Should use llava:7b model
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          body: expect.stringContaining('llava:7b'),
        })
      );
    });
  });

  // ===========================================================================
  // Host Tests
  // ===========================================================================

  describe('getHost', () => {
    it('should return configured host', () => {
      expect(client.getHost()).toBe('http://localhost:11434');
    });
  });

  // ===========================================================================
  // Required Models Check
  // ===========================================================================

  describe('checkRequiredModels', () => {
    it('should check for both triage and analysis models', async () => {
      const mockModels = [
        { name: 'moondream:latest', size: 1_000_000_000, modified_at: '2024-01-01', digest: 'abc' },
        { name: 'llava:7b', size: 4_000_000_000, modified_at: '2024-01-01', digest: 'def' },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ models: mockModels }),
      });

      const result = await client.checkRequiredModels();

      expect(result.triageModel).toBe(true);
      expect(result.analysisModel).toBe(true);
    });

    it('should report missing models', async () => {
      const mockModels = [
        { name: 'llava:7b', size: 4_000_000_000, modified_at: '2024-01-01', digest: 'def' },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ models: mockModels }),
      });

      const result = await client.checkRequiredModels();

      expect(result.triageModel).toBe(false);
      expect(result.analysisModel).toBe(true);
    });
  });
});

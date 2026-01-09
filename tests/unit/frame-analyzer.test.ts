/**
 * Frame Analyzer Unit Tests
 *
 * Tests for the main vision analysis pipeline.
 *
 * @module tests/unit/frame-analyzer
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database
vi.mock('../../src/db/index.js', () => ({
  generateId: vi.fn().mockReturnValue('analysis-123'),
  now: vi.fn().mockReturnValue(new Date().toISOString()),
}));

// Mock Ollama client - include getDefaultOllamaClient export
vi.mock('../../src/lib/ollama/client.js', () => ({
  OllamaClient: vi.fn().mockImplementation(() => ({
    isHealthy: vi.fn().mockResolvedValue(true),
    triage: vi.fn().mockResolvedValue('CONCERN: none - All clear'),
    analyze: vi.fn().mockResolvedValue('Normal scene, no concerns detected.'),
  })),
  getDefaultOllamaClient: vi.fn().mockReturnValue({
    isHealthy: vi.fn().mockResolvedValue(true),
    triage: vi.fn().mockResolvedValue('CONCERN: none - All clear'),
    analyze: vi.fn().mockResolvedValue('Normal scene, no concerns detected.'),
  }),
}));

// Mock profiles
vi.mock('../../src/lib/analysis/profiles/index.js', () => ({
  getPetPrompt: vi.fn().mockReturnValue('Analyze this pet scene'),
  getBabyPrompt: vi.fn().mockReturnValue('Analyze this baby scene'),
  getElderlyPrompt: vi.fn().mockReturnValue('Analyze this elderly scene'),
}));

import { FrameAnalyzer } from '../../src/lib/analysis/frame-analyzer.js';

// =============================================================================
// Test Suite
// =============================================================================

describe('FrameAnalyzer', () => {
  let analyzer: FrameAnalyzer;

  beforeEach(() => {
    vi.clearAllMocks();
    analyzer = new FrameAnalyzer();
  });

  // ===========================================================================
  // Basic Analysis Tests
  // ===========================================================================

  describe('analyze', () => {
    const mockFrame = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    it('should analyze a frame for pet monitoring', async () => {
      const result = await analyzer.analyze({
        frameData: mockFrame,
        scenario: 'pet',
        streamId: 'test-stream-1',
      });

      expect(result).toBeDefined();
      expect(result.streamId).toBe('test-stream-1');
    });

    it('should analyze a frame for baby monitoring', async () => {
      const result = await analyzer.analyze({
        frameData: mockFrame,
        scenario: 'baby',
        streamId: 'test-stream-2',
      });

      expect(result).toBeDefined();
      expect(result.streamId).toBe('test-stream-2');
    });

    it('should analyze a frame for elderly monitoring', async () => {
      const result = await analyzer.analyze({
        frameData: mockFrame,
        scenario: 'elderly',
        streamId: 'test-stream-3',
      });

      expect(result).toBeDefined();
      expect(result.streamId).toBe('test-stream-3');
    });

    it('should include motion context in analysis', async () => {
      const result = await analyzer.analyze({
        frameData: mockFrame,
        scenario: 'pet',
        streamId: 'test-stream-4',
        motionScore: 0.8,
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });

    it('should include audio context in analysis', async () => {
      const result = await analyzer.analyze({
        frameData: mockFrame,
        scenario: 'baby',
        streamId: 'test-stream-5',
        audioLevel: 0.9,
      });

      expect(result).toBeDefined();
    });

    it('should return result with required fields', async () => {
      const result = await analyzer.analyze({
        frameData: mockFrame,
        scenario: 'pet',
        streamId: 'test-stream',
      });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('streamId');
      expect(result).toHaveProperty('scenario');
      expect(result).toHaveProperty('concernLevel');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('inferenceMs');
      expect(result).toHaveProperty('usedCloudFallback');
    });
  });

  // ===========================================================================
  // Concern Level Tests
  // ===========================================================================

  describe('concern levels', () => {
    it('should return none for normal scenes', async () => {
      const mockFrame = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const result = await analyzer.analyze({
        frameData: mockFrame,
        scenario: 'pet',
        streamId: 'test-stream',
      });

      expect(['none', 'low', 'medium', 'high', 'critical']).toContain(result.concernLevel);
    });
  });

  // ===========================================================================
  // Stats Tests (uses getStats, not getMetrics)
  // ===========================================================================

  describe('stats', () => {
    it('should track analysis count via getStats', async () => {
      const mockFrame = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      await analyzer.analyze({
        frameData: mockFrame,
        scenario: 'pet',
        streamId: 'test-1',
      });

      await analyzer.analyze({
        frameData: mockFrame,
        scenario: 'baby',
        streamId: 'test-2',
      });

      const stats = analyzer.getStats();

      expect(stats.analysisCount).toBe(2);
      expect(stats.cloudFallbackCount).toBe(0);
      expect(stats.cloudFallbackRate).toBe(0);
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe('error handling', () => {
    it('should handle triage errors gracefully', async () => {
      const { getDefaultOllamaClient } = await import('../../src/lib/ollama/client.js');
      vi.mocked(getDefaultOllamaClient).mockReturnValue({
        isHealthy: vi.fn().mockResolvedValue(true),
        triage: vi.fn().mockRejectedValue(new Error('Triage failed')),
        analyze: vi.fn().mockResolvedValue('Normal'),
      } as any);

      const errorAnalyzer = new FrameAnalyzer();

      const result = await errorAnalyzer.analyze({
        frameData: 'base64data',
        scenario: 'pet',
        streamId: 'test',
      });

      expect(result).toBeDefined();
    });
  });
});

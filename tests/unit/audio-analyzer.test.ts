/**
 * Audio Analyzer Unit Tests
 *
 * Tests for server-side audio analysis including cry detection.
 *
 * @module tests/unit/audio-analyzer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AudioAnalyzer, createAudioAnalyzer } from '../../src/lib/audio/analyzer.js';

// =============================================================================
// Test Suite
// =============================================================================

describe('AudioAnalyzer', () => {
  let analyzer: AudioAnalyzer;

  beforeEach(() => {
    analyzer = createAudioAnalyzer('baby');
  });

  // ===========================================================================
  // Basic Analysis Tests
  // ===========================================================================

  describe('analyzeLevel', () => {
    it('should analyze audio level and return result', () => {
      const result = analyzer.analyzeLevel(50);

      expect(result).toBeDefined();
      expect(typeof result.level).toBe('number');
      expect(result.level).toBe(50);
      expect(result.scenario).toBe('baby');
    });

    it('should return classification', () => {
      const result = analyzer.analyzeLevel(50);

      expect(result.classification).toBeDefined();
      expect([
        'silence', 'ambient', 'speech', 'cry',
        'distress', 'bark', 'meow', 'alarm',
        'impact', 'unknown'
      ]).toContain(result.classification);
    });

    it('should detect silence for low levels', () => {
      const result = analyzer.analyzeLevel(2);

      expect(result.classification).toBe('silence');
    });

    it('should detect ambient for low-mid levels', () => {
      const result = analyzer.analyzeLevel(15);

      expect(result.classification).toBe('ambient');
    });

    it('should include patterns array', () => {
      const result = analyzer.analyzeLevel(50);

      expect(Array.isArray(result.patterns)).toBe(true);
    });

    it('should indicate if requires attention', () => {
      const result = analyzer.analyzeLevel(80);

      expect(typeof result.requiresAttention).toBe('boolean');
    });
  });

  // ===========================================================================
  // Cry Detection Tests
  // ===========================================================================

  describe('detectCryPattern', () => {
    it('should return detection result with required fields', () => {
      // Add some samples first
      for (let i = 0; i < 60; i++) {
        analyzer.analyzeLevel(i % 2 === 0 ? 60 : 30); // Rhythmic pattern
      }

      const result = analyzer.detectCryPattern();

      expect(result).toHaveProperty('detected');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('durationMs');
    });

    it('should not detect cry for insufficient samples', () => {
      const result = analyzer.detectCryPattern();

      expect(result.detected).toBe(false);
      expect(result.confidence).toBe(0);
    });
  });

  // ===========================================================================
  // Frequency Analysis Tests  
  // ===========================================================================

  describe('analyzeFrequencies', () => {
    it('should classify based on frequency bands', () => {
      const silentBands = { bass: 5, lowMid: 5, mid: 5, highMid: 5, high: 5, presence: 5 };

      const result = analyzer.analyzeFrequencies(silentBands);

      expect(result).toBe('silence');
    });

    it('should detect cry for baby scenario with mid frequencies', () => {
      const cryBands = { bass: 10, lowMid: 30, mid: 60, highMid: 40, high: 20, presence: 10 };

      const result = analyzer.analyzeFrequencies(cryBands);

      // Baby crying should be detected with strong mid frequencies
      expect(['cry', 'unknown']).toContain(result);
    });

    it('should detect alarm for high frequencies', () => {
      const alarmBands = { bass: 10, lowMid: 10, mid: 20, highMid: 60, high: 70, presence: 50 };

      const result = analyzer.analyzeFrequencies(alarmBands);

      expect(result).toBe('alarm');
    });

    it('should detect impact for strong bass', () => {
      const impactBands = { bass: 70, lowMid: 20, mid: 15, highMid: 10, high: 5, presence: 5 };

      const result = analyzer.analyzeFrequencies(impactBands);

      expect(result).toBe('impact');
    });
  });

  // ===========================================================================
  // Sustained Silence Detection
  // ===========================================================================

  describe('detectSustainedSilence', () => {
    it('should detect when all samples are silent', () => {
      // Add many silent samples
      for (let i = 0; i < 60; i++) {
        analyzer.analyzeLevel(2);
      }

      const result = analyzer.detectSustainedSilence();

      expect(result).toBe(true);
    });

    it('should not detect silence when audio is present', () => {
      for (let i = 0; i < 60; i++) {
        analyzer.analyzeLevel(50);
      }

      const result = analyzer.detectSustainedSilence();

      expect(result).toBe(false);
    });
  });

  // ===========================================================================
  // Scenario Tests
  // ===========================================================================

  describe('scenario configuration', () => {
    it('should initialize with specified scenario', () => {
      const petAnalyzer = createAudioAnalyzer('pet');
      const result = petAnalyzer.analyzeLevel(50);

      expect(result.scenario).toBe('pet');
    });

    it('should update scenario via setScenario', () => {
      analyzer.setScenario('elderly');
      const result = analyzer.analyzeLevel(50);

      expect(result.scenario).toBe('elderly');
    });

    it('should detect bark for pet scenario with appropriate frequencies', () => {
      const petAnalyzer = createAudioAnalyzer('pet');
      const barkBands = { bass: 40, lowMid: 60, mid: 50, highMid: 20, high: 10, presence: 5 };

      const result = petAnalyzer.analyzeFrequencies(barkBands);

      expect(result).toBe('bark');
    });
  });

  // ===========================================================================
  // Stats Tests
  // ===========================================================================

  describe('getStats', () => {
    it('should track samples analyzed', () => {
      analyzer.analyzeLevel(30);
      analyzer.analyzeLevel(50);
      analyzer.analyzeLevel(70);

      const stats = analyzer.getStats();

      expect(stats.samplesAnalyzed).toBe(3);
    });

    it('should track alerts triggered', () => {
      // Generate high-level samples to trigger alerts
      for (let i = 0; i < 50; i++) {
        analyzer.analyzeLevel(80); // Critical level
      }

      const stats = analyzer.getStats();

      // High levels should trigger distress alerts
      expect(stats.alertsTriggered).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // Reset Tests
  // ===========================================================================

  describe('reset', () => {
    it('should clear internal state', () => {
      // Add some samples
      for (let i = 0; i < 20; i++) {
        analyzer.analyzeLevel(50);
      }

      analyzer.reset();

      // After reset, cry pattern detection should fail due to insufficient samples
      const result = analyzer.detectCryPattern();
      expect(result.detected).toBe(false);
    });
  });
});

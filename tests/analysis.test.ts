/**
 * Frame Analyzer Tests
 */

import { describe, it, expect } from 'vitest';
import { getPetPrompt, getBabyPrompt, getElderlyPrompt } from '../src/lib/analysis/profiles/index.js';

describe('Detection Profiles', () => {
  describe('Pet Prompts', () => {
    it('should return triage prompt', () => {
      const prompt = getPetPrompt('triage');
      expect(prompt).toContain('pet monitoring');
      expect(prompt).toContain('NO CONCERN');
      expect(prompt).toContain('CRITICAL');
    });

    it('should return detailed prompt', () => {
      const prompt = getPetPrompt('detailed');
      expect(prompt).toContain('posture');
      expect(prompt).toContain('Activity level');
      expect(prompt).toContain('Environment safety');
    });
  });

  describe('Baby Prompts', () => {
    it('should return triage prompt with safety focus', () => {
      const prompt = getBabyPrompt('triage');
      expect(prompt).toContain('SUPPLEMENT');
      expect(prompt).toContain('Baby not visible');
      expect(prompt).toContain('Baby face down');
    });

    it('should return detailed prompt with position monitoring', () => {
      const prompt = getBabyPrompt('detailed');
      expect(prompt).toContain('Position and posture');
      expect(prompt).toContain('breathe freely');
      expect(prompt).toContain('hazards');
    });
  });

  describe('Elderly Prompts', () => {
    it('should return triage prompt with fall detection', () => {
      const prompt = getElderlyPrompt('triage');
      expect(prompt).toContain('Person on the floor');
      expect(prompt).toContain('Possible fall');
      expect(prompt).toContain('unresponsive');
    });

    it('should return detailed prompt with mobility focus', () => {
      const prompt = getElderlyPrompt('detailed');
      expect(prompt).toContain('Position and Mobility');
      expect(prompt).toContain('fall hazards');
      expect(prompt).toContain('Emergency items');
    });
  });
});

describe('Concern Level Parsing', () => {
  // Note: These tests would need the FrameAnalyzer to be instantiated
  // For now, we test the prompt structure

  it('should have consistent concern levels across all profiles', () => {
    const petPrompt = getPetPrompt('detailed');
    const babyPrompt = getBabyPrompt('detailed');
    const elderlyPrompt = getElderlyPrompt('detailed');

    const expectedLevels = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

    for (const level of expectedLevels) {
      expect(petPrompt.toUpperCase()).toContain(level);
      expect(babyPrompt.toUpperCase()).toContain(level);
      expect(elderlyPrompt.toUpperCase()).toContain(level);
    }
  });
});


/**
 * Audio Analyzer
 *
 * Server-side audio analysis for cry detection, distress sounds,
 * and unusual audio patterns.
 *
 * @module lib/audio/analyzer
 */

import type { MonitoringScenario, AnalysisResult, ConcernLevel } from '../../types/index.js';

// =============================================================================
// Types
// =============================================================================

export interface AudioAnalysisInput {
  samples: Float32Array | number[];
  sampleRate: number;
  channelCount: number;
  durationMs: number;
  rmsLevel: number;
}

export interface AudioAnalysisResult {
  detected: boolean;
  type: AudioEventType;
  confidence: number;
  concernLevel: ConcernLevel;
  details: string;
  frequencyPeaks: number[];
}

export type AudioEventType =
  | 'cry'
  | 'scream'
  | 'distress_word'
  | 'fall_impact'
  | 'glass_break'
  | 'barking'
  | 'whining'
  | 'meowing'
  | 'silence'
  | 'normal'
  | 'unknown';

// =============================================================================
// Configuration
// =============================================================================

export interface AudioAnalyzerConfig {
  cryDetectionEnabled: boolean;
  fallDetectionEnabled: boolean;
  distressWordsEnabled: boolean;
  silenceThresholdDb: number;
  loudSoundThresholdDb: number;
  analysisWindowMs: number;
  distressWords: string[];
}

const DEFAULT_CONFIG: AudioAnalyzerConfig = {
  cryDetectionEnabled: true,
  fallDetectionEnabled: true,
  distressWordsEnabled: true,
  silenceThresholdDb: -50,
  loudSoundThresholdDb: -10,
  analysisWindowMs: 2000,
  distressWords: ['help', 'stop', 'no', 'hurt', 'pain', 'fall', 'emergency'],
};

// Frequency ranges for different sounds (Hz)
const FREQUENCY_SIGNATURES = {
  babyCry: { low: 300, high: 600, peaks: [350, 450, 530] },
  infantCry: { low: 250, high: 650, peaks: [300, 400, 550, 600] },
  toddlerCry: { low: 200, high: 500, peaks: [250, 350, 450] },
  scream: { low: 1000, high: 4000, peaks: [1500, 2500, 3500] },
  dogBark: { low: 100, high: 2000, peaks: [200, 400, 800, 1200] },
  dogWhine: { low: 300, high: 1500, peaks: [400, 600, 900] },
  catMeow: { low: 200, high: 2000, peaks: [300, 500, 1000, 1500] },
  glassBraking: { low: 2000, high: 8000, peaks: [3000, 5000, 7000] },
  fallImpact: { low: 20, high: 200, peaks: [50, 100, 150] },
};

// =============================================================================
// Audio Analyzer
// =============================================================================

export class AudioAnalyzer {
  private config: AudioAnalyzerConfig;
  private fftSize = 2048;
  private analysisCount = 0;
  private detectionCount = 0;

  constructor(config?: Partial<AudioAnalyzerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===========================================================================
  // Main Analysis
  // ===========================================================================

  /**
   * Analyze audio for concerning sounds
   */
  async analyze(
    input: AudioAnalysisInput,
    scenario: MonitoringScenario
  ): Promise<AudioAnalysisResult[]> {
    this.analysisCount++;
    const results: AudioAnalysisResult[] = [];

    // Check for silence (could indicate problem with subject)
    if (input.rmsLevel < this.dbToLinear(this.config.silenceThresholdDb)) {
      results.push({
        detected: true,
        type: 'silence',
        confidence: 0.7,
        concernLevel: 'low',
        details: 'Extended silence detected',
        frequencyPeaks: [],
      });
    }

    // Get frequency spectrum
    const spectrum = this.computeSpectrum(input.samples, input.sampleRate);

    // Scenario-specific analysis
    if (scenario === 'baby') {
      const cryResult = this.detectCrying(spectrum, input.sampleRate);
      if (cryResult.detected) {
        this.detectionCount++;
        results.push(cryResult);
      }
    }

    if (scenario === 'pet') {
      const barkResult = this.detectBarking(spectrum, input.sampleRate);
      if (barkResult.detected) {
        this.detectionCount++;
        results.push(barkResult);
      }

      const whineResult = this.detectWhining(spectrum, input.sampleRate);
      if (whineResult.detected) {
        this.detectionCount++;
        results.push(whineResult);
      }
    }

    if (scenario === 'elderly' && this.config.fallDetectionEnabled) {
      const fallResult = this.detectFallImpact(spectrum, input.rmsLevel);
      if (fallResult.detected) {
        this.detectionCount++;
        results.push(fallResult);
      }
    }

    // Check for scream (all scenarios)
    const screamResult = this.detectScream(spectrum, input.sampleRate);
    if (screamResult.detected) {
      this.detectionCount++;
      results.push(screamResult);
    }

    // Glass breaking (all scenarios - indicates accident)
    const glassResult = this.detectGlassBreaking(spectrum, input.sampleRate);
    if (glassResult.detected) {
      this.detectionCount++;
      results.push(glassResult);
    }

    // If nothing detected
    if (results.length === 0) {
      results.push({
        detected: false,
        type: 'normal',
        confidence: 0.8,
        concernLevel: 'none',
        details: 'Normal audio levels',
        frequencyPeaks: [],
      });
    }

    return results;
  }

  // ===========================================================================
  // Sound Detection Methods
  // ===========================================================================

  /**
   * Detect baby/infant crying
   */
  private detectCrying(
    spectrum: Float32Array,
    sampleRate: number
  ): AudioAnalysisResult {
    const sig = FREQUENCY_SIGNATURES.babyCry;
    const peaks = this.findPeaksInRange(spectrum, sampleRate, sig.low, sig.high);

    // Check if peaks match crying pattern
    const matchScore = this.matchFrequencyPattern(peaks, sig.peaks);

    // Also check for harmonic structure (cries have harmonics)
    const hasHarmonics = this.detectHarmonics(spectrum, peaks[0] || 400, sampleRate);

    // Check temporal pattern - crying is rhythmic
    const confidence = Math.min(1, matchScore * (hasHarmonics ? 1.3 : 0.8));

    const detected = confidence > 0.6;

    return {
      detected,
      type: 'cry',
      confidence,
      concernLevel: detected ? (confidence > 0.85 ? 'high' : 'medium') : 'none',
      details: detected
        ? `Crying detected (${Math.round(confidence * 100)}% confidence)`
        : 'No crying detected',
      frequencyPeaks: peaks.slice(0, 5),
    };
  }

  /**
   * Detect dog barking
   */
  private detectBarking(
    spectrum: Float32Array,
    sampleRate: number
  ): AudioAnalysisResult {
    const sig = FREQUENCY_SIGNATURES.dogBark;
    const peaks = this.findPeaksInRange(spectrum, sampleRate, sig.low, sig.high);

    const matchScore = this.matchFrequencyPattern(peaks, sig.peaks);

    // Barks are impulsive with wide frequency spread
    const hasImpulsivePattern = peaks.length >= 3 && peaks[peaks.length - 1] > peaks[0] * 4;

    const confidence = Math.min(1, matchScore * (hasImpulsivePattern ? 1.2 : 0.9));
    const detected = confidence > 0.55;

    return {
      detected,
      type: 'barking',
      confidence,
      concernLevel: detected ? 'low' : 'none',
      details: detected
        ? `Barking detected (${Math.round(confidence * 100)}% confidence)`
        : 'No barking detected',
      frequencyPeaks: peaks.slice(0, 5),
    };
  }

  /**
   * Detect dog/cat whining (distress)
   */
  private detectWhining(
    spectrum: Float32Array,
    sampleRate: number
  ): AudioAnalysisResult {
    const sig = FREQUENCY_SIGNATURES.dogWhine;
    const peaks = this.findPeaksInRange(spectrum, sampleRate, sig.low, sig.high);

    const matchScore = this.matchFrequencyPattern(peaks, sig.peaks);

    // Whining is more tonal (fewer harmonics, narrow band)
    const isNarrowBand = peaks.length <= 3;

    const confidence = Math.min(1, matchScore * (isNarrowBand ? 1.2 : 0.8));
    const detected = confidence > 0.5;

    return {
      detected,
      type: 'whining',
      confidence,
      concernLevel: detected ? (confidence > 0.75 ? 'medium' : 'low') : 'none',
      details: detected
        ? `Whining/distress sound detected (${Math.round(confidence * 100)}% confidence)`
        : 'No whining detected',
      frequencyPeaks: peaks.slice(0, 5),
    };
  }

  /**
   * Detect scream/yelling
   */
  private detectScream(
    spectrum: Float32Array,
    sampleRate: number
  ): AudioAnalysisResult {
    const sig = FREQUENCY_SIGNATURES.scream;
    const peaks = this.findPeaksInRange(spectrum, sampleRate, sig.low, sig.high);

    // Screams are loud with high frequency content
    const highFreqEnergy = this.getEnergyInRange(spectrum, sampleRate, 1000, 4000);
    const totalEnergy = this.getTotalEnergy(spectrum);

    const highFreqRatio = totalEnergy > 0 ? highFreqEnergy / totalEnergy : 0;
    const matchScore = this.matchFrequencyPattern(peaks, sig.peaks);

    const confidence = Math.min(1, (matchScore + highFreqRatio) / 2 * 1.5);
    const detected = confidence > 0.6 && highFreqRatio > 0.3;

    return {
      detected,
      type: 'scream',
      confidence,
      concernLevel: detected ? 'high' : 'none',
      details: detected
        ? `Scream/yelling detected (${Math.round(confidence * 100)}% confidence)`
        : 'No screaming detected',
      frequencyPeaks: peaks.slice(0, 5),
    };
  }

  /**
   * Detect fall impact (low frequency thump)
   */
  private detectFallImpact(
    spectrum: Float32Array,
    rmsLevel: number
  ): AudioAnalysisResult {
    // Falls produce sudden loud low-frequency sound
    const sampleRate = 44100; // Assume standard rate
    const sig = FREQUENCY_SIGNATURES.fallImpact;
    const peaks = this.findPeaksInRange(spectrum, sampleRate, sig.low, sig.high);

    // Check for sudden loud low-frequency content
    const lowFreqEnergy = this.getEnergyInRange(spectrum, sampleRate, 20, 200);
    const midFreqEnergy = this.getEnergyInRange(spectrum, sampleRate, 200, 2000);

    const lowFreqDominance = midFreqEnergy > 0 ? lowFreqEnergy / midFreqEnergy : 0;
    const isLoud = rmsLevel > this.dbToLinear(this.config.loudSoundThresholdDb);

    const matchScore = this.matchFrequencyPattern(peaks, sig.peaks);
    const confidence = Math.min(1, (matchScore + lowFreqDominance) / 2 * (isLoud ? 1.5 : 0.7));

    const detected = confidence > 0.55 && lowFreqDominance > 2 && isLoud;

    return {
      detected,
      type: 'fall_impact',
      confidence,
      concernLevel: detected ? 'critical' : 'none',
      details: detected
        ? `Possible fall impact detected (${Math.round(confidence * 100)}% confidence)`
        : 'No fall impact detected',
      frequencyPeaks: peaks.slice(0, 5),
    };
  }

  /**
   * Detect glass breaking
   */
  private detectGlassBreaking(
    spectrum: Float32Array,
    sampleRate: number
  ): AudioAnalysisResult {
    const sig = FREQUENCY_SIGNATURES.glassBraking;
    const peaks = this.findPeaksInRange(spectrum, sampleRate, sig.low, sig.high);

    // Glass breaking has very high frequency content
    const highFreqEnergy = this.getEnergyInRange(spectrum, sampleRate, 3000, 8000);
    const totalEnergy = this.getTotalEnergy(spectrum);

    const highFreqRatio = totalEnergy > 0 ? highFreqEnergy / totalEnergy : 0;
    const matchScore = this.matchFrequencyPattern(peaks, sig.peaks);

    const confidence = Math.min(1, (matchScore + highFreqRatio) / 2 * 1.4);
    const detected = confidence > 0.6 && highFreqRatio > 0.4;

    return {
      detected,
      type: 'glass_break',
      confidence,
      concernLevel: detected ? 'high' : 'none',
      details: detected
        ? `Glass breaking detected (${Math.round(confidence * 100)}% confidence)`
        : 'No glass breaking detected',
      frequencyPeaks: peaks.slice(0, 5),
    };
  }

  // ===========================================================================
  // DSP Utilities
  // ===========================================================================

  /**
   * Compute frequency spectrum from samples
   * Simple DFT implementation (in production, use Web Audio API or fft.js)
   */
  private computeSpectrum(
    samples: Float32Array | number[],
    sampleRate: number
  ): Float32Array {
    const n = Math.min(this.fftSize, samples.length);
    const spectrum = new Float32Array(n / 2);

    // Simple magnitude spectrum calculation
    for (let k = 0; k < n / 2; k++) {
      let real = 0;
      let imag = 0;

      for (let j = 0; j < n; j++) {
        const sample = typeof samples[j] === 'number' ? samples[j] : 0;
        const angle = (2 * Math.PI * k * j) / n;
        real += sample * Math.cos(angle);
        imag -= sample * Math.sin(angle);
      }

      spectrum[k] = Math.sqrt(real * real + imag * imag) / n;
    }

    return spectrum;
  }

  /**
   * Find frequency peaks in a range
   */
  private findPeaksInRange(
    spectrum: Float32Array,
    sampleRate: number,
    lowHz: number,
    highHz: number
  ): number[] {
    const binWidth = sampleRate / (spectrum.length * 2);
    const lowBin = Math.floor(lowHz / binWidth);
    const highBin = Math.min(spectrum.length - 1, Math.ceil(highHz / binWidth));

    const peaks: { freq: number; mag: number }[] = [];

    for (let i = lowBin + 1; i < highBin - 1; i++) {
      // Local maximum detection
      if (spectrum[i] > spectrum[i - 1] && spectrum[i] > spectrum[i + 1]) {
        peaks.push({
          freq: i * binWidth,
          mag: spectrum[i],
        });
      }
    }

    // Sort by magnitude and return top frequencies
    peaks.sort((a, b) => b.mag - a.mag);
    return peaks.slice(0, 10).map((p) => Math.round(p.freq));
  }

  /**
   * Match detected peaks against expected pattern
   */
  private matchFrequencyPattern(detected: number[], expected: number[]): number {
    if (detected.length === 0 || expected.length === 0) return 0;

    let matches = 0;
    const tolerance = 50; // Hz

    for (const exp of expected) {
      for (const det of detected) {
        if (Math.abs(det - exp) <= tolerance) {
          matches++;
          break;
        }
      }
    }

    return matches / expected.length;
  }

  /**
   * Detect harmonic structure (fundamental + multiples)
   */
  private detectHarmonics(
    spectrum: Float32Array,
    fundamental: number,
    sampleRate: number
  ): boolean {
    const binWidth = sampleRate / (spectrum.length * 2);
    const fundamentalBin = Math.floor(fundamental / binWidth);

    if (fundamentalBin >= spectrum.length) return false;

    const fundamentalMag = spectrum[fundamentalBin];
    if (fundamentalMag < 0.01) return false;

    // Check for 2nd and 3rd harmonics
    let harmonicsFound = 0;

    for (const mult of [2, 3]) {
      const harmonicBin = fundamentalBin * mult;
      if (harmonicBin < spectrum.length) {
        const harmonicMag = spectrum[harmonicBin];
        if (harmonicMag > fundamentalMag * 0.2) {
          harmonicsFound++;
        }
      }
    }

    return harmonicsFound >= 1;
  }

  /**
   * Get energy in frequency range
   */
  private getEnergyInRange(
    spectrum: Float32Array,
    sampleRate: number,
    lowHz: number,
    highHz: number
  ): number {
    const binWidth = sampleRate / (spectrum.length * 2);
    const lowBin = Math.floor(lowHz / binWidth);
    const highBin = Math.min(spectrum.length - 1, Math.ceil(highHz / binWidth));

    let energy = 0;
    for (let i = lowBin; i <= highBin; i++) {
      energy += spectrum[i] * spectrum[i];
    }

    return energy;
  }

  /**
   * Get total spectral energy
   */
  private getTotalEnergy(spectrum: Float32Array): number {
    let energy = 0;
    for (let i = 0; i < spectrum.length; i++) {
      energy += spectrum[i] * spectrum[i];
    }
    return energy;
  }

  /**
   * Convert dB to linear amplitude
   */
  private dbToLinear(db: number): number {
    return Math.pow(10, db / 20);
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  updateConfig(config: Partial<AudioAnalyzerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): AudioAnalyzerConfig {
    return { ...this.config };
  }

  // ===========================================================================
  // Stats
  // ===========================================================================

  getStats(): { analysisCount: number; detectionCount: number; detectionRate: number } {
    return {
      analysisCount: this.analysisCount,
      detectionCount: this.detectionCount,
      detectionRate: this.analysisCount > 0 ? this.detectionCount / this.analysisCount : 0,
    };
  }
}

// =============================================================================
// Singleton
// =============================================================================

let defaultAnalyzer: AudioAnalyzer | null = null;

export function getDefaultAudioAnalyzer(): AudioAnalyzer {
  if (!defaultAnalyzer) {
    defaultAnalyzer = new AudioAnalyzer();
  }
  return defaultAnalyzer;
}


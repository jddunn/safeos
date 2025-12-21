/**
 * Audio Level Monitoring
 *
 * Web Audio API integration for audio level detection.
 * Used for crying detection, distress sounds, etc.
 *
 * @module lib/audio-levels
 */

/**
 * Get the current audio level from an AnalyserNode
 * Returns a value between 0 and 1
 */
export function getAudioLevel(analyser: AnalyserNode): number {
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);

  // Calculate RMS (root mean square) for a more accurate volume reading
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    const value = dataArray[i] / 255; // Normalize to 0-1
    sum += value * value;
  }
  const rms = Math.sqrt(sum / dataArray.length);

  // Scale up for better visibility (RMS tends to be low)
  return Math.min(rms * 2, 1);
}

/**
 * Get frequency-specific levels (for sound classification)
 */
export function getFrequencyLevels(analyser: AnalyserNode): {
  low: number;
  mid: number;
  high: number;
} {
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);

  const binCount = dataArray.length;
  const lowEnd = Math.floor(binCount / 4);
  const midEnd = Math.floor(binCount / 2);

  // Calculate average for each frequency range
  let lowSum = 0;
  let midSum = 0;
  let highSum = 0;

  for (let i = 0; i < binCount; i++) {
    const value = dataArray[i] / 255;
    if (i < lowEnd) {
      lowSum += value;
    } else if (i < midEnd) {
      midSum += value;
    } else {
      highSum += value;
    }
  }

  return {
    low: lowSum / lowEnd,
    mid: midSum / (midEnd - lowEnd),
    high: highSum / (binCount - midEnd),
  };
}

/**
 * Detect potential crying sounds
 * Crying typically has:
 * - High amplitude
 * - Rhythmic pattern
 * - Mid-to-high frequency content
 */
export function detectCryingPattern(
  analyser: AnalyserNode,
  history: number[] = []
): { isCrying: boolean; confidence: number } {
  const level = getAudioLevel(analyser);
  const frequencies = getFrequencyLevels(analyser);

  // Add current level to history
  history.push(level);
  if (history.length > 50) {
    history.shift();
  }

  // Check for sustained loud sound
  const recentLevels = history.slice(-20);
  const avgLevel =
    recentLevels.reduce((a, b) => a + b, 0) / recentLevels.length;

  // Check for rhythmic pattern (variance indicates on/off pattern of crying)
  const variance =
    recentLevels.reduce((sum, l) => sum + Math.pow(l - avgLevel, 2), 0) /
    recentLevels.length;

  // Crying indicators:
  // - Sustained level above 0.3
  // - Mid/high frequency emphasis
  // - Some variance (rhythmic)
  const isSustained = avgLevel > 0.3;
  const hasHighFreq = frequencies.mid > 0.2 || frequencies.high > 0.15;
  const isRhythmic = variance > 0.01 && variance < 0.1;

  const confidence =
    (isSustained ? 0.4 : 0) + (hasHighFreq ? 0.3 : 0) + (isRhythmic ? 0.3 : 0);

  return {
    isCrying: confidence > 0.6,
    confidence,
  };
}

/**
 * Audio threshold configurations by scenario
 */
export const AUDIO_THRESHOLDS = {
  pet: 0.3, // Pets are generally quiet
  baby: 0.15, // Sensitive to crying
  elderly: 0.2, // Medium sensitivity for calls for help
} as const;

export type Scenario = keyof typeof AUDIO_THRESHOLDS;

/**
 * Get audio threshold for a scenario
 */
export function getAudioThreshold(scenario: Scenario): number {
  return AUDIO_THRESHOLDS[scenario] || 0.25;
}


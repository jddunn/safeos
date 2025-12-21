/**
 * Motion Detection
 *
 * Client-side canvas-based pixel diff for motion detection.
 * Runs entirely in the browser - no server load.
 *
 * @module lib/motion-detection
 */

/**
 * Detect motion by comparing two frames
 */
export function detectMotion(
  previousFrame: ImageData,
  currentFrame: ImageData,
  threshold: number = 0.15
): { detected: boolean; score: number } {
  const pixels = currentFrame.data.length / 4;
  let changedPixels = 0;

  // Compare each pixel (RGBA format)
  for (let i = 0; i < currentFrame.data.length; i += 4) {
    // Calculate difference in RGB values
    const rDiff = Math.abs(currentFrame.data[i] - previousFrame.data[i]);
    const gDiff = Math.abs(currentFrame.data[i + 1] - previousFrame.data[i + 1]);
    const bDiff = Math.abs(currentFrame.data[i + 2] - previousFrame.data[i + 2]);

    // Total difference
    const totalDiff = rDiff + gDiff + bDiff;

    // Consider pixel changed if total diff > 30 (out of 765 max)
    if (totalDiff > 30) {
      changedPixels++;
    }
  }

  const score = changedPixels / pixels;
  return {
    detected: score > threshold,
    score,
  };
}

/**
 * Calculate motion score between two frames
 */
export function calculateMotionScore(
  previousFrame: ImageData,
  currentFrame: ImageData
): number {
  const { score } = detectMotion(previousFrame, currentFrame, 0);
  return score;
}

/**
 * Detect motion in specific regions of the frame
 */
export function detectRegionalMotion(
  previousFrame: ImageData,
  currentFrame: ImageData,
  regions: Array<{ x: number; y: number; width: number; height: number }>
): Array<{ region: number; score: number; detected: boolean }> {
  const results: Array<{ region: number; score: number; detected: boolean }> = [];

  for (let regionIndex = 0; regionIndex < regions.length; regionIndex++) {
    const region = regions[regionIndex];
    let changedPixels = 0;
    let totalPixels = 0;

    for (let y = region.y; y < region.y + region.height; y++) {
      for (let x = region.x; x < region.x + region.width; x++) {
        const i = (y * currentFrame.width + x) * 4;

        if (i >= 0 && i < currentFrame.data.length - 3) {
          totalPixels++;

          const rDiff = Math.abs(currentFrame.data[i] - previousFrame.data[i]);
          const gDiff = Math.abs(
            currentFrame.data[i + 1] - previousFrame.data[i + 1]
          );
          const bDiff = Math.abs(
            currentFrame.data[i + 2] - previousFrame.data[i + 2]
          );

          if (rDiff + gDiff + bDiff > 30) {
            changedPixels++;
          }
        }
      }
    }

    const score = totalPixels > 0 ? changedPixels / totalPixels : 0;
    results.push({
      region: regionIndex,
      score,
      detected: score > 0.15,
    });
  }

  return results;
}

/**
 * Scenario-specific thresholds
 */
export const MOTION_THRESHOLDS = {
  pet: 0.2, // Pets move around, higher threshold
  baby: 0.1, // Babies should be relatively still, lower threshold
  elderly: 0.15, // Medium threshold for elderly
} as const;

export type Scenario = keyof typeof MOTION_THRESHOLDS;

/**
 * Get threshold for a scenario
 */
export function getThresholdForScenario(scenario: Scenario): number {
  return MOTION_THRESHOLDS[scenario] || 0.15;
}


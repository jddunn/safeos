'use client';

interface MotionDetectorProps {
  score: number;
  threshold?: number;
}

export default function MotionDetector({
  score,
  threshold = 0.15,
}: MotionDetectorProps) {
  const percentage = Math.round(score * 100);
  const isAboveThreshold = score > threshold;

  const getColor = () => {
    if (score < 0.1) return 'bg-green-500';
    if (score < 0.2) return 'bg-yellow-500';
    if (score < 0.4) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-white/60">Motion Detection</span>
          <span
            className={`text-xs font-mono ${
              isAboveThreshold ? 'text-yellow-400' : 'text-white/60'
            }`}
          >
            {percentage}%
          </span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-100 ${getColor()}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
        {/* Threshold marker */}
        <div className="relative h-0">
          <div
            className="absolute bottom-0 w-px h-2 bg-white/40"
            style={{ left: `${threshold * 100}%` }}
          />
        </div>
      </div>
      {isAboveThreshold && (
        <div className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse" />
      )}
    </div>
  );
}


'use client';

interface AudioMonitorProps {
  level: number;
  bars?: number;
}

export default function AudioMonitor({ level, bars = 8 }: AudioMonitorProps) {
  const normalizedLevel = Math.min(Math.max(level, 0), 1);
  const activeBars = Math.round(normalizedLevel * bars);

  const getBarColor = (index: number) => {
    const threshold = index / bars;
    if (threshold < 0.6) return 'bg-green-500';
    if (threshold < 0.8) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="audio-meter">
      {Array.from({ length: bars }).map((_, index) => {
        const isActive = index < activeBars;
        const height = 4 + (index / bars) * 20;
        
        return (
          <div
            key={index}
            className={`audio-bar transition-all duration-75 ${
              isActive ? getBarColor(index) : 'bg-white/10'
            }`}
            style={{ height: `${height}px` }}
          />
        );
      })}
    </div>
  );
}


'use client';

import { useEffect, useRef, useState } from 'react';
import { useMonitoringStore, type Alert, type AlertSeverity } from '@/stores/monitoring-store';

// =============================================================================
// Types
// =============================================================================

interface AlertPanelProps {
  maxAlerts?: number;
  showControls?: boolean;
  className?: string;
}

interface EscalationLevel {
  level: number;
  volume: number;
  sound: string;
  interval: number;
}

// =============================================================================
// Configuration
// =============================================================================

const ESCALATION_LEVELS: EscalationLevel[] = [
  { level: 0, volume: 0.3, sound: '/sounds/alert-soft.mp3', interval: 10000 },
  { level: 1, volume: 0.5, sound: '/sounds/alert-medium.mp3', interval: 8000 },
  { level: 2, volume: 0.7, sound: '/sounds/alert-loud.mp3', interval: 6000 },
  { level: 3, volume: 0.85, sound: '/sounds/alert-urgent.mp3', interval: 4000 },
  { level: 4, volume: 1.0, sound: '/sounds/alert-critical.mp3', interval: 2000 },
];

const SEVERITY_STARTING_LEVEL: Record<AlertSeverity, number> = {
  info: 0,
  warning: 0,
  urgent: 1,
  critical: 2,
};

// =============================================================================
// Alert Panel Component
// =============================================================================

export default function AlertPanel({
  maxAlerts = 5,
  showControls = true,
  className = '',
}: AlertPanelProps) {
  const {
    alerts,
    activeAlerts,
    soundEnabled,
    volume,
    acknowledgeAlert,
    acknowledgeAllAlerts,
    toggleSound,
    setVolume,
  } = useMonitoringStore();

  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [escalationLevels, setEscalationLevels] = useState<Map<string, number>>(
    new Map()
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const escalationTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio();
    return () => {
      // Cleanup timers
      escalationTimers.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  // Handle new alerts - start escalation
  useEffect(() => {
    const unacknowledged = alerts.filter((a) => !a.acknowledged);

    for (const alert of unacknowledged) {
      if (!escalationLevels.has(alert.id)) {
        const startLevel = SEVERITY_STARTING_LEVEL[alert.severity];
        setEscalationLevels((prev) => new Map(prev).set(alert.id, startLevel));

        // Start escalation timer
        startEscalation(alert.id, startLevel);

        // Play initial sound
        if (soundEnabled) {
          playAlertSound(startLevel);
        }
      }
    }

    // Clean up acknowledged alerts
    for (const alertId of escalationLevels.keys()) {
      const alert = alerts.find((a) => a.id === alertId);
      if (!alert || alert.acknowledged) {
        stopEscalation(alertId);
        setEscalationLevels((prev) => {
          const next = new Map(prev);
          next.delete(alertId);
          return next;
        });
      }
    }
  }, [alerts, soundEnabled]);

  const startEscalation = (alertId: string, currentLevel: number) => {
    if (currentLevel >= ESCALATION_LEVELS.length - 1) return;

    const config = ESCALATION_LEVELS[currentLevel];
    const timer = setTimeout(() => {
      const newLevel = currentLevel + 1;
      setEscalationLevels((prev) => new Map(prev).set(alertId, newLevel));

      if (soundEnabled) {
        playAlertSound(newLevel);
      }

      startEscalation(alertId, newLevel);
    }, config.interval);

    escalationTimers.current.set(alertId, timer);
  };

  const stopEscalation = (alertId: string) => {
    const timer = escalationTimers.current.get(alertId);
    if (timer) {
      clearTimeout(timer);
      escalationTimers.current.delete(alertId);
    }
  };

  const playAlertSound = (level: number) => {
    if (!audioRef.current) return;

    const config = ESCALATION_LEVELS[level];
    audioRef.current.src = config.sound;
    audioRef.current.volume = config.volume * (volume / 100);
    audioRef.current.play().catch(console.error);
  };

  const handleAcknowledge = (alertId: string) => {
    stopEscalation(alertId);
    acknowledgeAlert(alertId);
  };

  const handleAcknowledgeAll = () => {
    escalationTimers.current.forEach((timer) => clearTimeout(timer));
    escalationTimers.current.clear();
    setEscalationLevels(new Map());
    acknowledgeAllAlerts();
  };

  const visibleAlerts = alerts.slice(0, maxAlerts);

  return (
    <div className={`bg-white/5 rounded-xl border border-white/10 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">Alerts</h3>
          {activeAlerts > 0 && (
            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full animate-pulse">
              {activeAlerts} active
            </span>
          )}
        </div>

        {showControls && (
          <div className="flex items-center gap-2">
            {activeAlerts > 0 && (
              <button
                onClick={handleAcknowledgeAll}
                className="text-xs text-white/60 hover:text-white"
              >
                Ack All
              </button>
            )}
            <button
              onClick={toggleSound}
              className={`p-2 rounded-lg transition ${
                soundEnabled ? 'bg-safeos-500/20 text-safeos-400' : 'bg-white/10 text-white/40'
              }`}
            >
              {soundEnabled ? '🔊' : '🔇'}
            </button>
          </div>
        )}
      </div>

      {/* Volume Control (when sound enabled) */}
      {showControls && soundEnabled && (
        <div className="px-4 py-2 border-b border-white/10 flex items-center gap-2">
          <span className="text-xs text-white/40">Volume</span>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => setVolume(parseInt(e.target.value))}
            className="flex-1 accent-safeos-500 h-1"
          />
          <span className="text-xs text-white/60 w-8">{volume}%</span>
        </div>
      )}

      {/* Alert List */}
      <div className="divide-y divide-white/5">
        {visibleAlerts.length === 0 ? (
          <div className="p-8 text-center text-white/40">
            <p>No alerts</p>
            <p className="text-sm mt-1">Alerts will appear here when detected</p>
          </div>
        ) : (
          visibleAlerts.map((alert) => (
            <AlertItem
              key={alert.id}
              alert={alert}
              escalationLevel={escalationLevels.get(alert.id) || 0}
              isExpanded={expandedAlert === alert.id}
              onExpand={() =>
                setExpandedAlert(expandedAlert === alert.id ? null : alert.id)
              }
              onAcknowledge={() => handleAcknowledge(alert.id)}
            />
          ))
        )}
      </div>

      {/* Footer - More alerts indicator */}
      {alerts.length > maxAlerts && (
        <div className="p-3 text-center border-t border-white/10">
          <span className="text-xs text-white/40">
            +{alerts.length - maxAlerts} more alerts
          </span>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Alert Item Component
// =============================================================================

interface AlertItemProps {
  alert: Alert;
  escalationLevel: number;
  isExpanded: boolean;
  onExpand: () => void;
  onAcknowledge: () => void;
}

function AlertItem({
  alert,
  escalationLevel,
  isExpanded,
  onExpand,
  onAcknowledge,
}: AlertItemProps) {
  const severityColors: Record<AlertSeverity, string> = {
    info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    urgent: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  const severityIcons: Record<AlertSeverity, string> = {
    info: 'ℹ️',
    warning: '⚠️',
    urgent: '🚨',
    critical: '🆘',
  };

  const timeAgo = getTimeAgo(new Date(alert.timestamp));

  return (
    <div
      className={`p-4 transition ${
        alert.acknowledged ? 'opacity-50' : ''
      } ${!alert.acknowledged && escalationLevel >= 3 ? 'animate-pulse' : ''}`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="text-xl">{severityIcons[alert.severity]}</div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`px-2 py-0.5 rounded text-xs border ${
                severityColors[alert.severity]
              }`}
            >
              {alert.severity.toUpperCase()}
            </span>
            {!alert.acknowledged && escalationLevel > 0 && (
              <span className="text-xs text-orange-400">
                Level {escalationLevel}
              </span>
            )}
            <span className="text-xs text-white/40">{timeAgo}</span>
          </div>

          <p
            className={`text-sm text-white/80 ${
              isExpanded ? '' : 'truncate'
            }`}
            onClick={onExpand}
          >
            {alert.message}
          </p>

          {isExpanded && (
            <div className="mt-2 text-xs text-white/40">
              <p>Stream: {alert.streamId}</p>
              <p>Type: {alert.type}</p>
              <p>Time: {new Date(alert.timestamp).toLocaleString()}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        {!alert.acknowledged && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAcknowledge();
            }}
            className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-sm whitespace-nowrap"
          >
            Ack
          </button>
        )}
      </div>

      {/* Escalation Progress Bar */}
      {!alert.acknowledged && escalationLevel > 0 && (
        <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 transition-all duration-1000"
            style={{ width: `${(escalationLevel / 4) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Utility
// =============================================================================

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

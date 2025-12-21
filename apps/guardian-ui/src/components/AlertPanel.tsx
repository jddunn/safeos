'use client';

interface Alert {
  id: string;
  severity: string;
  message: string;
  createdAt: string;
}

interface AlertPanelProps {
  alerts: Alert[];
  onAcknowledge?: (alertId: string) => void;
}

export default function AlertPanel({ alerts, onAcknowledge }: AlertPanelProps) {
  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'critical':
        return {
          bg: 'bg-red-500/20',
          border: 'border-red-500/50',
          icon: '🆘',
          text: 'text-red-400',
        };
      case 'urgent':
        return {
          bg: 'bg-orange-500/20',
          border: 'border-orange-500/50',
          icon: '🚨',
          text: 'text-orange-400',
        };
      case 'warning':
        return {
          bg: 'bg-yellow-500/20',
          border: 'border-yellow-500/50',
          icon: '⚠️',
          text: 'text-yellow-400',
        };
      default:
        return {
          bg: 'bg-blue-500/20',
          border: 'border-blue-500/50',
          icon: 'ℹ️',
          text: 'text-blue-400',
        };
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (alerts.length === 0) {
    return (
      <div className="bg-white/5 rounded-lg p-4">
        <h3 className="text-sm font-medium text-white/80 mb-3">Alerts</h3>
        <div className="text-center py-8 text-white/40">
          <svg
            className="w-8 h-8 mx-auto mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          <p className="text-xs">No alerts</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-white/80">Alerts</h3>
        <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
          {alerts.length} active
        </span>
      </div>
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {alerts.map((alert) => {
          const styles = getSeverityStyles(alert.severity);
          
          return (
            <div
              key={alert.id}
              className={`${styles.bg} border ${styles.border} rounded-lg p-3 ${
                alert.severity === 'critical' ? 'alert-pulse' : ''
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="text-lg">{styles.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-medium uppercase ${styles.text}`}
                    >
                      {alert.severity}
                    </span>
                    <span className="text-xs text-white/40">
                      {formatTime(alert.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-white/80 mt-1 line-clamp-2">
                    {alert.message}
                  </p>
                </div>
                {onAcknowledge && (
                  <button
                    onClick={() => onAcknowledge(alert.id)}
                    className="text-white/40 hover:text-white/80 transition p-1"
                    title="Acknowledge"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


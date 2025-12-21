'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Alert {
  id: string;
  stream_id: string;
  alert_type: string;
  severity: string;
  message: string;
  escalation_level: number;
  acknowledged: number;
  created_at: string;
  acknowledged_at: string | null;
}

interface AlertStats {
  totalAlerts: number;
  unacknowledgedAlerts: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  avgResponseTimeMs: number;
}

export default function HistoryPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    severity: 'all',
    acknowledged: 'all',
    period: '24h',
  });

  useEffect(() => {
    fetchAlerts();
    fetchStats();
  }, [filter]);

  async function fetchAlerts() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.severity !== 'all') params.set('severity', filter.severity);
      if (filter.acknowledged !== 'all') params.set('acknowledged', filter.acknowledged);
      params.set('limit', '100');

      const res = await fetch(`/api/alerts?${params}`);
      const data = await res.json();
      if (data.success) {
        setAlerts(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchStats() {
    try {
      const res = await fetch(`/api/alerts/stats/summary?period=${filter.period}`);
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }

  async function acknowledgeAlert(alertId: string) {
    try {
      const res = await fetch(`/api/alerts/${alertId}/acknowledge`, { method: 'POST' });
      if (res.ok) {
        setAlerts((prev) =>
          prev.map((a) =>
            a.id === alertId
              ? { ...a, acknowledged: 1, acknowledged_at: new Date().toISOString() }
              : a
          )
        );
      }
    } catch (error) {
      console.error('Failed to acknowledge:', error);
    }
  }

  async function acknowledgeAll() {
    try {
      const res = await fetch('/api/alerts/acknowledge-all', { method: 'POST' });
      if (res.ok) {
        fetchAlerts();
      }
    } catch (error) {
      console.error('Failed to acknowledge all:', error);
    }
  }

  const severityColors: Record<string, string> = {
    info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    urgent: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  const typeIcons: Record<string, string> = {
    motion: '👁️',
    audio: '🔊',
    concern: '⚠️',
    system: '🔧',
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-white/5 backdrop-blur-xl sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-white/60 hover:text-white">
                ← Back
              </Link>
              <h1 className="text-xl font-semibold">Alert History</h1>
            </div>
            <button
              onClick={acknowledgeAll}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded text-sm"
            >
              Acknowledge All
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="Total Alerts"
              value={stats.totalAlerts}
              sublabel={filter.period}
            />
            <StatCard
              label="Unacknowledged"
              value={stats.unacknowledgedAlerts}
              sublabel="active"
              highlight={stats.unacknowledgedAlerts > 0}
            />
            <StatCard
              label="Critical"
              value={stats.bySeverity.critical || 0}
              sublabel="alerts"
              type="critical"
            />
            <StatCard
              label="Avg Response"
              value={
                stats.avgResponseTimeMs > 60000
                  ? `${Math.round(stats.avgResponseTimeMs / 60000)}m`
                  : `${Math.round(stats.avgResponseTimeMs / 1000)}s`
              }
              sublabel="time"
            />
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <select
            value={filter.severity}
            onChange={(e) => setFilter((f) => ({ ...f, severity: e.target.value }))}
            className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm"
          >
            <option value="all">All Severities</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="urgent">Urgent</option>
            <option value="critical">Critical</option>
          </select>

          <select
            value={filter.acknowledged}
            onChange={(e) => setFilter((f) => ({ ...f, acknowledged: e.target.value }))}
            className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm"
          >
            <option value="all">All Status</option>
            <option value="false">Unacknowledged</option>
            <option value="true">Acknowledged</option>
          </select>

          <select
            value={filter.period}
            onChange={(e) => setFilter((f) => ({ ...f, period: e.target.value }))}
            className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>

        {/* Alert List */}
        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-2 border-white/20 border-t-safeos-400 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white/60">Loading alerts...</p>
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-8 text-center text-white/40">
              <p>No alerts found</p>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 hover:bg-white/5 transition ${
                    alert.acknowledged ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="text-2xl">{typeIcons[alert.alert_type] || '📢'}</div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`px-2 py-0.5 rounded text-xs border ${
                            severityColors[alert.severity] || 'bg-white/10 text-white/60'
                          }`}
                        >
                          {alert.severity.toUpperCase()}
                        </span>
                        <span className="text-white/40 text-xs capitalize">
                          {alert.alert_type}
                        </span>
                        {alert.escalation_level > 0 && (
                          <span className="text-orange-400 text-xs">
                            Level {alert.escalation_level}
                          </span>
                        )}
                      </div>
                      <p className="text-white/80 text-sm">{alert.message}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-white/40">
                        <span>{new Date(alert.created_at).toLocaleString()}</span>
                        {alert.acknowledged_at && (
                          <span>
                            Acknowledged {new Date(alert.acknowledged_at).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    {!alert.acknowledged && (
                      <button
                        onClick={() => acknowledgeAlert(alert.id)}
                        className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-sm"
                      >
                        Acknowledge
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  sublabel,
  highlight,
  type,
}: {
  label: string;
  value: string | number;
  sublabel: string;
  highlight?: boolean;
  type?: 'critical' | 'warning';
}) {
  let bgClass = 'bg-white/5';
  let borderClass = 'border-white/10';

  if (highlight) {
    bgClass = 'bg-orange-500/10';
    borderClass = 'border-orange-500/30';
  } else if (type === 'critical') {
    bgClass = 'bg-red-500/10';
    borderClass = 'border-red-500/30';
  }

  return (
    <div className={`${bgClass} rounded-xl p-4 border ${borderClass}`}>
      <div className="text-white/60 text-sm mb-1">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-white/40 text-xs">{sublabel}</div>
    </div>
  );
}


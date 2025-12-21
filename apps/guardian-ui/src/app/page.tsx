'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { useMonitoringStore } from '@/stores/monitoring-store';

// =============================================================================
// Types
// =============================================================================

interface SystemStatus {
  database: boolean;
  ollama: { healthy: boolean; models: { name: string }[] };
  webrtc: { peers: number; rooms: number };
  queue: { pending: number; processing: number; processed: number };
}

interface RecentAlert {
  id: string;
  severity: string;
  message: string;
  created_at: string;
  acknowledged: boolean;
}

// =============================================================================
// Dashboard Page
// =============================================================================

export default function DashboardPage() {
  const { isOnboardingComplete, selectedScenarios, primaryScenario } =
    useOnboardingStore();
  const { isStreaming, activeAlerts } = useMonitoringStore();

  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<RecentAlert[]>([]);
  const [loading, setLoading] = useState(true);

  // Redirect to setup if not onboarded
  useEffect(() => {
    if (!isOnboardingComplete) {
      window.location.href = '/setup';
    }
  }, [isOnboardingComplete]);

  // Fetch system status
  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch('/api/system/status');
        const data = await res.json();
        if (data.success) {
          setSystemStatus(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch status:', error);
      }
    }

    async function fetchAlerts() {
      try {
        const res = await fetch('/api/alerts?limit=5');
        const data = await res.json();
        if (data.success) {
          setRecentAlerts(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch alerts:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStatus();
    fetchAlerts();

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchStatus();
      fetchAlerts();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const scenarioIcons: Record<string, string> = {
    pet: '🐾',
    baby: '👶',
    elderly: '🧓',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0f0f18] to-[#0a0a0f] text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-white/5 backdrop-blur-xl sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-safeos-500 to-cyan-500 flex items-center justify-center text-xl">
                🛡️
              </div>
              <div>
                <h1 className="text-xl font-bold">SafeOS</h1>
                <p className="text-xs text-white/50">Guardian Dashboard</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Link
                href="/settings"
                className="p-2 hover:bg-white/10 rounded-lg transition"
              >
                ⚙️
              </Link>
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                  isStreaming
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-white/10 text-white/60'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isStreaming ? 'bg-green-400 animate-pulse' : 'bg-white/40'
                  }`}
                />
                {isStreaming ? 'Monitoring' : 'Idle'}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Link
            href="/monitor"
            className="p-6 bg-gradient-to-br from-safeos-500/20 to-cyan-500/20 rounded-2xl border border-safeos-500/30 hover:border-safeos-500/50 transition group"
          >
            <div className="text-3xl mb-2">📹</div>
            <h3 className="font-semibold group-hover:text-safeos-400 transition">
              Start Monitoring
            </h3>
            <p className="text-sm text-white/50">Begin live camera feed</p>
          </Link>

          <Link
            href="/history"
            className="p-6 bg-white/5 rounded-2xl border border-white/10 hover:border-white/20 transition group"
          >
            <div className="text-3xl mb-2">📋</div>
            <h3 className="font-semibold group-hover:text-white transition">
              Alert History
            </h3>
            <p className="text-sm text-white/50">View past alerts</p>
          </Link>

          <Link
            href="/profiles"
            className="p-6 bg-white/5 rounded-2xl border border-white/10 hover:border-white/20 transition group"
          >
            <div className="text-3xl mb-2">📊</div>
            <h3 className="font-semibold group-hover:text-white transition">
              Profiles
            </h3>
            <p className="text-sm text-white/50">Manage monitoring profiles</p>
          </Link>

          <Link
            href="/settings"
            className="p-6 bg-white/5 rounded-2xl border border-white/10 hover:border-white/20 transition group"
          >
            <div className="text-3xl mb-2">⚙️</div>
            <h3 className="font-semibold group-hover:text-white transition">
              Settings
            </h3>
            <p className="text-sm text-white/50">Configure notifications</p>
          </Link>
        </div>

        {/* Active Alerts Banner */}
        {activeAlerts > 0 && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center text-xl animate-pulse">
                🚨
              </div>
              <div>
                <h3 className="font-semibold text-red-400">
                  {activeAlerts} Active Alert{activeAlerts > 1 ? 's' : ''}
                </h3>
                <p className="text-sm text-white/60">
                  Requires your attention
                </p>
              </div>
            </div>
            <Link
              href="/history"
              className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-sm font-medium"
            >
              View Alerts
            </Link>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          {/* System Status */}
          <section className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
                🔧
              </span>
              System Status
            </h2>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-10 bg-white/5 rounded animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <StatusRow
                  label="Database"
                  status={systemStatus?.database ? 'online' : 'offline'}
                />
                <StatusRow
                  label="Local AI (Ollama)"
                  status={systemStatus?.ollama?.healthy ? 'online' : 'offline'}
                  detail={
                    systemStatus?.ollama?.models
                      ? `${systemStatus.ollama.models.length} models`
                      : undefined
                  }
                />
                <StatusRow
                  label="Analysis Queue"
                  status="online"
                  detail={`${systemStatus?.queue?.pending || 0} pending`}
                />
                <StatusRow
                  label="WebRTC"
                  status="online"
                  detail={`${systemStatus?.webrtc?.peers || 0} peers`}
                />
              </div>
            )}
          </section>

          {/* Active Scenarios */}
          <section className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400">
                🎯
              </span>
              Active Scenarios
            </h2>

            <div className="space-y-3">
              {selectedScenarios.length === 0 ? (
                <p className="text-white/40 text-center py-4">
                  No scenarios configured
                </p>
              ) : (
                selectedScenarios.map((scenario) => (
                  <div
                    key={scenario}
                    className={`flex items-center justify-between p-3 rounded-xl transition ${
                      primaryScenario === scenario
                        ? 'bg-safeos-500/10 border border-safeos-500/30'
                        : 'bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">
                        {scenarioIcons[scenario]}
                      </span>
                      <span className="capitalize font-medium">{scenario}</span>
                      {primaryScenario === scenario && (
                        <span className="text-xs bg-safeos-500/20 text-safeos-400 px-2 py-0.5 rounded">
                          Primary
                        </span>
                      )}
                    </div>
                    <span className="text-white/40 text-sm">Active</span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Recent Alerts */}
        <section className="mt-8 bg-white/5 rounded-2xl p-6 border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
                ⚠️
              </span>
              Recent Alerts
            </h2>
            <Link href="/history" className="text-safeos-400 text-sm hover:underline">
              View All →
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 bg-white/5 rounded animate-pulse"
                />
              ))}
            </div>
          ) : recentAlerts.length === 0 ? (
            <div className="text-center py-8 text-white/40">
              <p>No alerts yet</p>
              <p className="text-sm mt-1">Start monitoring to see alerts here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentAlerts.map((alert) => (
                <AlertRow key={alert.id} alert={alert} />
              ))}
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="mt-12 text-center text-white/30 text-sm">
          <p>
            SafeOS by{' '}
            <a
              href="https://supercloud.ai"
              className="text-safeos-400 hover:underline"
            >
              SuperCloud
            </a>
          </p>
          <p className="mt-1">
            10% of revenue to humanity • 10% to wildlife
          </p>
        </footer>
      </main>
    </div>
  );
}

// =============================================================================
// Components
// =============================================================================

function StatusRow({
  label,
  status,
  detail,
}: {
  label: string;
  status: 'online' | 'offline' | 'warning';
  detail?: string;
}) {
  const statusColors = {
    online: 'bg-green-500',
    offline: 'bg-red-500',
    warning: 'bg-yellow-500',
  };

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <span className="text-white/80">{label}</span>
        {detail && <span className="text-white/40 text-xs">({detail})</span>}
      </div>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
        <span className="text-white/60 text-sm capitalize">{status}</span>
      </div>
    </div>
  );
}

function AlertRow({ alert }: { alert: RecentAlert }) {
  const severityColors: Record<string, string> = {
    info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    urgent: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  const timeAgo = getTimeAgo(new Date(alert.created_at));

  return (
    <div
      className={`flex items-center justify-between p-3 rounded-xl ${
        alert.acknowledged ? 'opacity-60' : ''
      } bg-white/5`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`px-2 py-0.5 rounded text-xs border ${
            severityColors[alert.severity] || 'bg-white/10'
          }`}
        >
          {alert.severity.toUpperCase()}
        </span>
        <span className="text-white/80 text-sm truncate max-w-xs">
          {alert.message}
        </span>
      </div>
      <span className="text-white/40 text-xs whitespace-nowrap">{timeAgo}</span>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

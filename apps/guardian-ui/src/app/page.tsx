'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface SystemStatus {
  activeStreams: number;
  pendingAlerts: number;
  queuedJobs: number;
  ollama: {
    healthy: boolean;
    models: {
      triageReady: boolean;
      analysisReady: boolean;
      missing: string[];
    } | null;
  };
  connectedClients: number;
  uptime: number;
}

export default function Dashboard() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        if (data.success) {
          setStatus(data.data);
        } else {
          setError(data.error || 'Failed to fetch status');
        }
      } catch (err) {
        setError('Cannot connect to SafeOS API. Is the server running?');
      } finally {
        setLoading(false);
      }
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-safeos-400 to-safeos-200 bg-clip-text text-transparent">
          SafeOS Guardian
        </h1>
        <p className="text-white/60 max-w-xl mx-auto">
          Free AI-powered monitoring that supplements (never replaces) human care.
          Part of SuperCloud&apos;s humanitarian mission.
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatusCard
          title="Active Streams"
          value={loading ? '...' : status?.activeStreams ?? 0}
          icon="📹"
          color="blue"
        />
        <StatusCard
          title="Pending Alerts"
          value={loading ? '...' : status?.pendingAlerts ?? 0}
          icon="🔔"
          color={status?.pendingAlerts ? 'red' : 'green'}
        />
        <StatusCard
          title="Ollama Status"
          value={loading ? '...' : status?.ollama?.healthy ? 'Online' : 'Offline'}
          icon="🤖"
          color={status?.ollama?.healthy ? 'green' : 'red'}
        />
        <StatusCard
          title="Queued Jobs"
          value={loading ? '...' : status?.queuedJobs ?? 0}
          icon="📊"
          color="purple"
        />
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-8">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="font-semibold text-red-400">Connection Error</h3>
              <p className="text-sm text-white/60">{error}</p>
              <p className="text-xs text-white/40 mt-2">
                Start the API: <code className="bg-black/30 px-2 py-1 rounded">npm run safeos:api</code>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Ollama Models */}
      {status?.ollama && !status.ollama.healthy && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-8">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🤖</span>
            <div>
              <h3 className="font-semibold text-yellow-400">Ollama Not Running</h3>
              <p className="text-sm text-white/60 mt-1">
                SafeOS requires Ollama for local AI analysis. Start it with:
              </p>
              <pre className="bg-black/30 px-3 py-2 rounded mt-2 text-xs font-mono">
                ollama serve
              </pre>
              {status.ollama.models?.missing && status.ollama.models.missing.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm text-white/60">Missing models:</p>
                  <pre className="bg-black/30 px-3 py-2 rounded mt-1 text-xs font-mono">
                    {status.ollama.models.missing.map(m => `ollama pull ${m}`).join('\n')}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Link href="/setup" className="profile-card group">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-safeos-500/20 flex items-center justify-center text-2xl">
              🐾
            </div>
            <div>
              <h3 className="font-semibold text-white group-hover:text-safeos-400 transition">
                Pet Monitoring
              </h3>
              <p className="text-sm text-white/60">Watch your furry friends</p>
            </div>
          </div>
          <p className="text-xs text-white/40">
            Monitor for eating, drinking, activity, and distress.
          </p>
        </Link>

        <Link href="/setup" className="profile-card group">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-2xl">
              👶
            </div>
            <div>
              <h3 className="font-semibold text-white group-hover:text-blue-400 transition">
                Baby Monitor
              </h3>
              <p className="text-sm text-white/60">Supplement to supervision</p>
            </div>
          </div>
          <p className="text-xs text-white/40">
            Crying detection, position monitoring, sleep safety alerts.
          </p>
        </Link>

        <Link href="/setup" className="profile-card group">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center text-2xl">
              👴
            </div>
            <div>
              <h3 className="font-semibold text-white group-hover:text-purple-400 transition">
                Elderly Care
              </h3>
              <p className="text-sm text-white/60">Supplement to caregiving</p>
            </div>
          </div>
          <p className="text-xs text-white/40">
            Fall detection, inactivity alerts, distress monitoring.
          </p>
        </Link>
      </div>

      {/* Disclaimer */}
      <div className="bg-white/5 rounded-lg p-6 text-center">
        <p className="text-sm text-white/60">
          <strong className="text-white/80">Important:</strong> SafeOS is a supplementary
          monitoring tool. It does NOT replace in-person care, supervision, or medical
          attention. Always maintain appropriate human oversight.
        </p>
      </div>
    </div>
  );
}

function StatusCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  icon: string;
  color: 'green' | 'blue' | 'red' | 'purple';
}) {
  const colorClasses = {
    green: 'from-green-500/20 to-green-600/10 border-green-500/30',
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    red: 'from-red-500/20 to-red-600/10 border-red-500/30',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
  };

  return (
    <div
      className={`bg-gradient-to-br ${colorClasses[color]} border rounded-lg p-4`}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-xs text-white/60 uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}


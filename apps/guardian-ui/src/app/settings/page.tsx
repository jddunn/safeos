'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useMonitoringStore } from '@/stores/monitoring-store';

interface SystemStatus {
  database: boolean;
  ollama: boolean;
  webrtc: { peers: number; rooms: number };
  notifications: {
    telegram: { enabled: boolean; chatCount: number };
    twilio: { enabled: boolean; phoneCount: number };
    push: { enabled: boolean; subscriptionCount: number };
  };
}

export default function SettingsPage() {
  const {
    soundEnabled,
    volume,
    notificationsEnabled,
    setVolume,
    toggleSound,
    toggleNotifications,
  } = useMonitoringStore();

  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [telegramChatId, setTelegramChatId] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [saving, setSaving] = useState(false);

  // Fetch system status
  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch('/api/system/status');
        const data = await res.json();
        if (data.success) {
          setSystemStatus({
            database: true,
            ollama: data.data.ollama?.healthy || false,
            webrtc: data.data.webrtc || { peers: 0, rooms: 0 },
            notifications: data.data.notifications || {
              telegram: { enabled: false, chatCount: 0 },
              twilio: { enabled: false, phoneCount: 0 },
              push: { enabled: false, subscriptionCount: 0 },
            },
          });

          if (data.data.ollama?.models) {
            setOllamaModels(data.data.ollama.models.map((m: { name: string }) => m.name));
          }
        }
      } catch (error) {
        console.error('Failed to fetch status:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStatus();
  }, []);

  const handleRegisterTelegram = async () => {
    if (!telegramChatId.trim()) return;

    setSaving(true);
    try {
      const res = await fetch('/api/notifications/telegram/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: telegramChatId }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Telegram registered successfully!');
        setTelegramChatId('');
      } else {
        alert('Failed to register: ' + data.error);
      }
    } catch (error) {
      alert('Failed to register Telegram');
    } finally {
      setSaving(false);
    }
  };

  const handleRegisterPhone = async () => {
    if (!phoneNumber.trim()) return;

    setSaving(true);
    try {
      const res = await fetch('/api/notifications/twilio/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Phone number registered successfully!');
        setPhoneNumber('');
      } else {
        alert('Failed to register: ' + data.error);
      }
    } catch (error) {
      alert('Failed to register phone');
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = async (channel: string) => {
    try {
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          targetId: channel === 'telegram' ? telegramChatId : phoneNumber,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Test ${channel} notification sent!`);
      } else {
        alert('Failed: ' + data.error);
      }
    } catch (error) {
      alert('Failed to send test notification');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-white/5 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-white/60 hover:text-white">
                ← Back
              </Link>
              <h1 className="text-xl font-semibold">Settings</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* System Status */}
          <section className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
                🔧
              </span>
              System Status
            </h2>

            {loading ? (
              <div className="animate-pulse space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 bg-white/5 rounded" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <StatusItem
                  label="Database"
                  status={systemStatus?.database ? 'connected' : 'disconnected'}
                />
                <StatusItem
                  label="Ollama AI"
                  status={systemStatus?.ollama ? 'running' : 'offline'}
                  detail={ollamaModels.length > 0 ? ollamaModels.join(', ') : undefined}
                />
                <StatusItem
                  label="WebRTC"
                  status="active"
                  detail={`${systemStatus?.webrtc.peers || 0} peers, ${systemStatus?.webrtc.rooms || 0} rooms`}
                />
              </div>
            )}
          </section>

          {/* Sound Settings */}
          <section className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400">
                🔊
              </span>
              Sound Settings
            </h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-white/80">Enable Sounds</span>
                <button
                  onClick={toggleSound}
                  className={`w-12 h-6 rounded-full transition ${
                    soundEnabled ? 'bg-safeos-500' : 'bg-white/20'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow transition transform ${
                      soundEnabled ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-white/80">Volume</span>
                  <span className="text-white/60 text-sm">{volume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => setVolume(parseInt(e.target.value))}
                  disabled={!soundEnabled}
                  className="w-full accent-safeos-500"
                />
              </div>
            </div>
          </section>

          {/* Notification Settings */}
          <section className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center text-green-400">
                🔔
              </span>
              Notifications
            </h2>

            <div className="space-y-6">
              {/* Browser Notifications */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-white/80 block">Browser Notifications</span>
                  <span className="text-white/40 text-sm">
                    {systemStatus?.notifications.push.subscriptionCount || 0} subscriptions
                  </span>
                </div>
                <button
                  onClick={toggleNotifications}
                  className={`w-12 h-6 rounded-full transition ${
                    notificationsEnabled ? 'bg-safeos-500' : 'bg-white/20'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow transition transform ${
                      notificationsEnabled ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Telegram */}
              <div className="pt-4 border-t border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/80">Telegram Bot</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      systemStatus?.notifications.telegram.enabled
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-white/10 text-white/40'
                    }`}
                  >
                    {systemStatus?.notifications.telegram.enabled ? 'Enabled' : 'Not configured'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    placeholder="Chat ID"
                    className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-2 text-sm"
                  />
                  <button
                    onClick={handleRegisterTelegram}
                    disabled={saving || !telegramChatId}
                    className="px-4 py-2 bg-safeos-500 hover:bg-safeos-600 rounded text-sm disabled:opacity-50"
                  >
                    Register
                  </button>
                </div>
              </div>

              {/* SMS */}
              <div className="pt-4 border-t border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/80">SMS Alerts</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      systemStatus?.notifications.twilio.enabled
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-white/10 text-white/40'
                    }`}
                  >
                    {systemStatus?.notifications.twilio.enabled ? 'Enabled' : 'Not configured'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+1 234 567 8900"
                    className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-2 text-sm"
                  />
                  <button
                    onClick={handleRegisterPhone}
                    disabled={saving || !phoneNumber}
                    className="px-4 py-2 bg-safeos-500 hover:bg-safeos-600 rounded text-sm disabled:opacity-50"
                  >
                    Register
                  </button>
                </div>
                <p className="text-white/40 text-xs mt-2">
                  SMS only sent for urgent/critical alerts to minimize costs
                </p>
              </div>
            </div>
          </section>

          {/* Danger Zone */}
          <section className="bg-red-500/5 rounded-xl p-6 border border-red-500/20">
            <h2 className="text-lg font-semibold mb-4 text-red-400">Danger Zone</h2>
            <div className="space-y-4">
              <button className="w-full px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded text-sm border border-red-500/20">
                Clear All Alert History
              </button>
              <button className="w-full px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded text-sm border border-red-500/20">
                Reset All Settings
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function StatusItem({
  label,
  status,
  detail,
}: {
  label: string;
  status: 'connected' | 'disconnected' | 'running' | 'offline' | 'active';
  detail?: string;
}) {
  const statusColors: Record<string, string> = {
    connected: 'bg-green-500',
    running: 'bg-green-500',
    active: 'bg-green-500',
    disconnected: 'bg-red-500',
    offline: 'bg-yellow-500',
  };

  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <span className="text-white/80">{label}</span>
        {detail && <span className="text-white/40 text-sm block">{detail}</span>}
      </div>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
        <span className="text-white/60 text-sm capitalize">{status}</span>
      </div>
    </div>
  );
}


'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface MonitoringProfile {
  id: string;
  name: string;
  scenario: 'pet' | 'baby' | 'elderly';
  icon: string;
  settings: ProfileSettings;
  is_active: number;
  created_at: string;
}

interface ProfileSettings {
  motionSensitivity: number;
  audioSensitivity: number;
  analysisInterval: number;
  cryDetection?: boolean;
  fallDetection?: boolean;
  inactivityAlertMins?: number;
  distressWords?: string[];
}

const SCENARIO_INFO: Record<string, { icon: string; description: string; color: string }> = {
  pet: {
    icon: '🐾',
    description: 'Monitor pets for distress, eating, accidents, or inactivity',
    color: 'amber',
  },
  baby: {
    icon: '👶',
    description: 'Watch toddlers and infants with cry detection and movement alerts',
    color: 'pink',
  },
  elderly: {
    icon: '🧓',
    description: 'Care monitoring with fall detection and inactivity warnings',
    color: 'blue',
  },
};

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<MonitoringProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newProfile, setNewProfile] = useState({
    name: '',
    scenario: 'pet' as const,
    settings: {
      motionSensitivity: 50,
      audioSensitivity: 50,
      analysisInterval: 30,
    },
  });

  useEffect(() => {
    fetchProfiles();
  }, []);

  async function fetchProfiles() {
    try {
      const res = await fetch('/api/profiles');
      const data = await res.json();
      if (data.success) {
        setProfiles(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch profiles:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createProfile() {
    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProfile),
      });
      const data = await res.json();
      if (data.success) {
        setProfiles((prev) => [...prev, data.data]);
        setCreating(false);
        setNewProfile({
          name: '',
          scenario: 'pet',
          settings: {
            motionSensitivity: 50,
            audioSensitivity: 50,
            analysisInterval: 30,
          },
        });
      }
    } catch (error) {
      console.error('Failed to create profile:', error);
    }
  }

  async function deleteProfile(profileId: string) {
    if (!confirm('Delete this profile?')) return;

    try {
      const res = await fetch(`/api/profiles/${profileId}`, { method: 'DELETE' });
      if (res.ok) {
        setProfiles((prev) => prev.filter((p) => p.id !== profileId));
      }
    } catch (error) {
      console.error('Failed to delete profile:', error);
    }
  }

  async function setActiveProfile(profileId: string) {
    try {
      const res = await fetch(`/api/profiles/${profileId}/activate`, { method: 'POST' });
      if (res.ok) {
        setProfiles((prev) =>
          prev.map((p) => ({ ...p, is_active: p.id === profileId ? 1 : 0 }))
        );
      }
    } catch (error) {
      console.error('Failed to activate profile:', error);
    }
  }

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
              <h1 className="text-xl font-semibold">Monitoring Profiles</h1>
            </div>
            <button
              onClick={() => setCreating(true)}
              className="px-4 py-2 bg-safeos-500 hover:bg-safeos-600 rounded text-sm"
            >
              + New Profile
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Create Profile Modal */}
        {creating && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-[#141418] rounded-xl p-6 max-w-md w-full border border-white/10">
              <h2 className="text-lg font-semibold mb-4">Create New Profile</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-white/60 mb-1">Profile Name</label>
                  <input
                    type="text"
                    value={newProfile.name}
                    onChange={(e) =>
                      setNewProfile((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="e.g., Living Room - Dog"
                    className="w-full bg-white/5 border border-white/10 rounded px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-2">Scenario Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['pet', 'baby', 'elderly'] as const).map((scenario) => (
                      <button
                        key={scenario}
                        onClick={() => setNewProfile((p) => ({ ...p, scenario }))}
                        className={`p-3 rounded-lg border text-center transition ${
                          newProfile.scenario === scenario
                            ? 'bg-safeos-500/20 border-safeos-500'
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <div className="text-2xl mb-1">{SCENARIO_INFO[scenario].icon}</div>
                        <div className="text-sm capitalize">{scenario}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-1">
                    Motion Sensitivity: {newProfile.settings.motionSensitivity}%
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={newProfile.settings.motionSensitivity}
                    onChange={(e) =>
                      setNewProfile((p) => ({
                        ...p,
                        settings: {
                          ...p.settings,
                          motionSensitivity: parseInt(e.target.value),
                        },
                      }))
                    }
                    className="w-full accent-safeos-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-1">
                    Audio Sensitivity: {newProfile.settings.audioSensitivity}%
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={newProfile.settings.audioSensitivity}
                    onChange={(e) =>
                      setNewProfile((p) => ({
                        ...p,
                        settings: {
                          ...p.settings,
                          audioSensitivity: parseInt(e.target.value),
                        },
                      }))
                    }
                    className="w-full accent-safeos-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setCreating(false)}
                  className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={createProfile}
                  disabled={!newProfile.name}
                  className="flex-1 px-4 py-2 bg-safeos-500 hover:bg-safeos-600 rounded disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Profile Cards */}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-48 bg-white/5 rounded-xl animate-pulse border border-white/10"
              />
            ))}
          </div>
        ) : profiles.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">📋</div>
            <h2 className="text-xl font-semibold mb-2">No Profiles Yet</h2>
            <p className="text-white/60 mb-6">
              Create your first monitoring profile to get started
            </p>
            <button
              onClick={() => setCreating(true)}
              className="px-6 py-3 bg-safeos-500 hover:bg-safeos-600 rounded-lg"
            >
              Create Profile
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {profiles.map((profile) => {
              const info = SCENARIO_INFO[profile.scenario] || SCENARIO_INFO.pet;
              const settings =
                typeof profile.settings === 'string'
                  ? JSON.parse(profile.settings)
                  : profile.settings;

              return (
                <div
                  key={profile.id}
                  className={`bg-white/5 rounded-xl p-5 border transition ${
                    profile.is_active
                      ? 'border-safeos-500 ring-1 ring-safeos-500/30'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">{info.icon}</div>
                      <div>
                        <h3 className="font-semibold">{profile.name}</h3>
                        <p className="text-sm text-white/60 capitalize">{profile.scenario}</p>
                      </div>
                    </div>
                    {profile.is_active ? (
                      <span className="px-2 py-0.5 bg-safeos-500/20 text-safeos-400 text-xs rounded">
                        Active
                      </span>
                    ) : null}
                  </div>

                  <p className="text-sm text-white/40 mb-4">{info.description}</p>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/60">Motion Sensitivity</span>
                      <span>{settings.motionSensitivity || 50}%</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/60">Audio Sensitivity</span>
                      <span>{settings.audioSensitivity || 50}%</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/60">Analysis Interval</span>
                      <span>{settings.analysisInterval || 30}s</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {!profile.is_active && (
                      <button
                        onClick={() => setActiveProfile(profile.id)}
                        className="flex-1 px-3 py-2 bg-safeos-500 hover:bg-safeos-600 rounded text-sm"
                      >
                        Activate
                      </button>
                    )}
                    <button
                      onClick={() => deleteProfile(profile.id)}
                      className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}


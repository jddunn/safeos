'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/stores/onboarding-store';

// =============================================================================
// Disclaimers (imported from backend - duplicated here for client)
// =============================================================================

const CRITICAL_DISCLAIMER = `
⚠️ IMPORTANT SAFETY NOTICE - PLEASE READ CAREFULLY ⚠️

SafeOS is a SUPPLEMENTARY monitoring tool provided FREE OF CHARGE by SuperCloud as part of our humanitarian mission.

This service is NOT intended to replace:
• Professional medical care or monitoring
• Parental supervision or childcare
• Professional elderly care services
• Veterinary care or pet supervision
• Emergency services (911)
• Any form of professional caregiving

LIMITATIONS:
• AI systems can make mistakes
• Technology can fail (power outages, network issues)
• Detection is not 100% accurate
• There may be delays in alerts
• This service may be unavailable at times

By using SafeOS, you acknowledge that:
1. You remain FULLY RESPONSIBLE for the care and safety of those you monitor
2. This is a supplementary tool, not a primary care solution
3. You will NOT leave dependents unsupervised based solely on this service
4. You will maintain appropriate professional care arrangements
5. You will respond promptly to any concerns, regardless of alerts

USE AT YOUR OWN RISK.
In case of emergency, ALWAYS call 911.
`.trim();

const CONSENT_ITEMS = [
  {
    id: 'not_replacement',
    required: true,
    text: 'I understand SafeOS is NOT a replacement for professional care, parental supervision, or emergency services.',
  },
  {
    id: 'responsibility',
    required: true,
    text: 'I remain fully responsible for the safety and care of those I monitor.',
  },
  {
    id: 'liability',
    required: true,
    text: 'I waive all liability claims and accept this service is provided as-is without warranty.',
  },
  {
    id: 'ai_moderation',
    required: true,
    text: 'I consent to AI-powered content moderation and understand flagged content may be human-reviewed.',
  },
  {
    id: 'emergency',
    required: true,
    text: 'I will call 911 or emergency services for actual emergencies, not rely on this service.',
  },
  {
    id: 'privacy',
    required: false,
    text: 'I have read and understand the privacy policy and how my data is handled.',
  },
  {
    id: 'abuse_policy',
    required: true,
    text: 'I understand that abuse of this service will result in account termination and potential law enforcement referral.',
  },
];

const SCENARIOS = [
  {
    id: 'pet',
    icon: '🐾',
    name: 'Pet Monitoring',
    description: 'Watch over dogs, cats, and other pets while you\'re away',
    features: ['Distress detection', 'Activity monitoring', 'Eating/drinking alerts', 'Accident detection'],
  },
  {
    id: 'baby',
    icon: '👶',
    name: 'Baby & Toddler',
    description: 'Monitor infants and young children with cry detection',
    features: ['Cry detection', 'Movement alerts', 'Sleep monitoring', 'Safety zone warnings'],
  },
  {
    id: 'elderly',
    icon: '🧓',
    name: 'Elderly Care',
    description: 'Support seniors with fall detection and activity monitoring',
    features: ['Fall detection', 'Inactivity alerts', 'Distress detection', 'Routine monitoring'],
  },
];

// =============================================================================
// Setup Page Component
// =============================================================================

export default function SetupPage() {
  const router = useRouter();
  const {
    step,
    acceptedDisclaimers,
    selectedScenarios,
    setStep,
    acceptDisclaimer,
    selectScenario,
    completeOnboarding,
    isOnboardingComplete,
  } = useOnboardingStore();

  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [allRequiredAccepted, setAllRequiredAccepted] = useState(false);

  // Check if already onboarded
  useEffect(() => {
    if (isOnboardingComplete) {
      router.push('/monitor');
    }
  }, [isOnboardingComplete, router]);

  // Check if all required disclaimers are accepted
  useEffect(() => {
    const requiredIds = CONSENT_ITEMS.filter((item) => item.required).map((item) => item.id);
    const allAccepted = requiredIds.every((id) => acceptedDisclaimers.includes(id));
    setAllRequiredAccepted(allAccepted);
  }, [acceptedDisclaimers]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    if (atBottom) {
      setScrolledToBottom(true);
    }
  };

  const handleComplete = () => {
    if (selectedScenarios.length === 0) {
      alert('Please select at least one monitoring scenario');
      return;
    }
    completeOnboarding();
    router.push('/monitor');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0f0f18] to-[#0a0a0f] text-white">
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-white/10 z-50">
        <div
          className="h-full bg-gradient-to-r from-safeos-500 to-safeos-400 transition-all duration-500"
          style={{ width: `${(step / 3) * 100}%` }}
        />
      </div>

      {/* Header */}
      <header className="pt-8 pb-4">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-safeos-400 to-cyan-400 bg-clip-text text-transparent">
            SafeOS Setup
          </h1>
          <p className="text-white/60 mt-2">
            Step {step} of 3
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Step 1: Welcome & Disclaimer */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">🛡️</div>
              <h2 className="text-2xl font-semibold mb-2">Welcome to SafeOS</h2>
              <p className="text-white/60">
                A free humanitarian monitoring service by SuperCloud
              </p>
            </div>

            {/* Disclaimer Box */}
            <div
              className="bg-white/5 border border-white/10 rounded-xl p-4 h-80 overflow-y-auto font-mono text-sm text-white/70"
              onScroll={handleScroll}
            >
              <pre className="whitespace-pre-wrap">{CRITICAL_DISCLAIMER}</pre>
            </div>

            {!scrolledToBottom && (
              <p className="text-center text-amber-400 text-sm animate-pulse">
                ↓ Scroll to read the entire disclaimer
              </p>
            )}

            <button
              onClick={() => setStep(2)}
              disabled={!scrolledToBottom}
              className={`w-full py-4 rounded-xl font-semibold text-lg transition ${
                scrolledToBottom
                  ? 'bg-safeos-500 hover:bg-safeos-600 text-white'
                  : 'bg-white/10 text-white/40 cursor-not-allowed'
              }`}
            >
              I Have Read the Disclaimer
            </button>
          </div>
        )}

        {/* Step 2: Consent Checkboxes */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">✅</div>
              <h2 className="text-2xl font-semibold mb-2">Confirm Your Understanding</h2>
              <p className="text-white/60">
                Please acknowledge each item to continue
              </p>
            </div>

            <div className="space-y-3">
              {CONSENT_ITEMS.map((item) => (
                <label
                  key={item.id}
                  className={`flex items-start gap-3 p-4 rounded-xl border transition cursor-pointer ${
                    acceptedDisclaimers.includes(item.id)
                      ? 'bg-safeos-500/10 border-safeos-500/30'
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={acceptedDisclaimers.includes(item.id)}
                    onChange={() => acceptDisclaimer(item.id)}
                    className="mt-1 w-5 h-5 rounded accent-safeos-500"
                  />
                  <div>
                    <span className="text-white/90">{item.text}</span>
                    {item.required && (
                      <span className="text-red-400 text-xs ml-1">*</span>
                    )}
                  </div>
                </label>
              ))}
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!allRequiredAccepted}
                className={`flex-1 py-3 rounded-xl font-semibold transition ${
                  allRequiredAccepted
                    ? 'bg-safeos-500 hover:bg-safeos-600 text-white'
                    : 'bg-white/10 text-white/40 cursor-not-allowed'
                }`}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Scenario Selection */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">🎯</div>
              <h2 className="text-2xl font-semibold mb-2">Choose Your Scenario</h2>
              <p className="text-white/60">
                Select what you'll be monitoring (you can change this later)
              </p>
            </div>

            <div className="space-y-4">
              {SCENARIOS.map((scenario) => (
                <button
                  key={scenario.id}
                  onClick={() => selectScenario(scenario.id as 'pet' | 'baby' | 'elderly')}
                  className={`w-full p-5 rounded-xl border text-left transition ${
                    selectedScenarios.includes(scenario.id as 'pet' | 'baby' | 'elderly')
                      ? 'bg-safeos-500/10 border-safeos-500/50 ring-1 ring-safeos-500/30'
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="text-4xl">{scenario.icon}</div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">{scenario.name}</h3>
                      <p className="text-white/60 text-sm mb-3">{scenario.description}</p>
                      <div className="flex flex-wrap gap-2">
                        {scenario.features.map((feature) => (
                          <span
                            key={feature}
                            className="px-2 py-0.5 bg-white/10 rounded text-xs text-white/70"
                          >
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>
                    {selectedScenarios.includes(scenario.id as 'pet' | 'baby' | 'elderly') && (
                      <div className="text-safeos-400 text-2xl">✓</div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl"
              >
                Back
              </button>
              <button
                onClick={handleComplete}
                disabled={selectedScenarios.length === 0}
                className={`flex-1 py-3 rounded-xl font-semibold transition ${
                  selectedScenarios.length > 0
                    ? 'bg-gradient-to-r from-safeos-500 to-cyan-500 hover:from-safeos-600 hover:to-cyan-600 text-white'
                    : 'bg-white/10 text-white/40 cursor-not-allowed'
                }`}
              >
                Start Monitoring 🚀
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-white/40 text-sm">
          <p>
            SafeOS is a free service by{' '}
            <a href="https://supercloud.ai" className="text-safeos-400 hover:underline">
              SuperCloud
            </a>
          </p>
          <p className="mt-1">
            10% of revenue dedicated to humanity, 10% to wildlife
          </p>
        </div>
      </main>
    </div>
  );
}

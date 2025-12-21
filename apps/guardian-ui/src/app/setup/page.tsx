'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ProfileSelector from '@/components/ProfileSelector';

type Scenario = 'pet' | 'baby' | 'elderly';

interface OnboardingStep {
  id: string;
  title: string;
  content: string;
  requiresAcknowledgment: boolean;
  acknowledgmentText?: string;
}

const DISCLAIMERS: Record<Scenario, OnboardingStep[]> = {
  pet: [
    {
      id: 'critical',
      title: 'Important Safety Notice',
      content: `SAFEOS IS A SUPPLEMENTARY MONITORING TOOL ONLY.

This service:
• Does NOT replace in-person care, supervision, or medical attention
• Does NOT guarantee detection of all events or emergencies
• May experience delays, outages, or missed detections
• Uses AI that can make mistakes and miss important events

You MUST maintain appropriate human supervision at all times.

By using this service, you acknowledge and accept these limitations.`,
      requiresAcknowledgment: true,
      acknowledgmentText: 'I understand SafeOS is a supplementary tool only',
    },
    {
      id: 'pet-specific',
      title: 'Pet Monitoring Disclaimer',
      content: `PET MONITORING DISCLAIMER

SafeOS provides supplementary pet monitoring only.

• This is NOT a replacement for proper pet care
• AI may not detect all signs of pet distress or illness
• Monitoring may be interrupted by technical issues
• Some pet emergencies may not be visually apparent

Always ensure your pet has:
• Adequate food, water, and shelter
• Regular veterinary care
• Appropriate supervision for their needs

Contact a veterinarian for any health concerns.`,
      requiresAcknowledgment: true,
      acknowledgmentText: 'I understand SafeOS supplements but does not replace proper pet care',
    },
  ],
  baby: [
    {
      id: 'critical',
      title: 'Important Safety Notice',
      content: `SAFEOS IS A SUPPLEMENTARY MONITORING TOOL ONLY.

This service:
• Does NOT replace in-person care, supervision, or medical attention
• Does NOT guarantee detection of all events or emergencies
• May experience delays, outages, or missed detections
• Uses AI that can make mistakes and miss important events

You MUST maintain appropriate human supervision at all times.

By using this service, you acknowledge and accept these limitations.`,
      requiresAcknowledgment: true,
      acknowledgmentText: 'I understand SafeOS is a supplementary tool only',
    },
    {
      id: 'baby-specific',
      title: 'Baby Monitoring Disclaimer',
      content: `BABY/TODDLER MONITORING DISCLAIMER

SafeOS is NOT a replacement for parental supervision.

• This is NOT a medical device
• This is NOT a certified baby monitor
• This does NOT replace the need for a parent/caregiver to be present
• AI detection may fail to identify dangerous situations
• Network or power failures may interrupt monitoring

NEVER leave a baby or toddler unattended based solely on this service.
Always follow safe sleep guidelines from pediatric organizations.
In any emergency, call emergency services immediately.`,
      requiresAcknowledgment: true,
      acknowledgmentText:
        'I understand SafeOS does NOT replace parental supervision and I will maintain appropriate oversight at all times',
    },
  ],
  elderly: [
    {
      id: 'critical',
      title: 'Important Safety Notice',
      content: `SAFEOS IS A SUPPLEMENTARY MONITORING TOOL ONLY.

This service:
• Does NOT replace in-person care, supervision, or medical attention
• Does NOT guarantee detection of all events or emergencies
• May experience delays, outages, or missed detections
• Uses AI that can make mistakes and miss important events

You MUST maintain appropriate human supervision at all times.

By using this service, you acknowledge and accept these limitations.`,
      requiresAcknowledgment: true,
      acknowledgmentText: 'I understand SafeOS is a supplementary tool only',
    },
    {
      id: 'elderly-specific',
      title: 'Elderly Care Disclaimer',
      content: `ELDERLY CARE MONITORING DISCLAIMER

SafeOS is NOT a replacement for professional care.

• This is NOT a medical monitoring device
• This is NOT a Life Alert or medical emergency system
• This does NOT replace professional caregivers
• AI detection may fail to identify falls or medical emergencies
• There may be significant delays in detection and notification

This service supplements but does not replace:
• Regular check-ins by family or caregivers
• Professional medical monitoring systems
• Emergency response services (911)

If you suspect a medical emergency, call emergency services immediately.`,
      requiresAcknowledgment: true,
      acknowledgmentText:
        'I understand SafeOS does NOT replace professional care and I will ensure appropriate human supervision',
    },
  ],
};

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<'profile' | 'disclaimers' | 'complete'>('profile');
  const [selectedProfile, setSelectedProfile] = useState<Scenario | null>(null);
  const [disclaimerIndex, setDisclaimerIndex] = useState(0);
  const [acknowledged, setAcknowledged] = useState<Record<string, boolean>>({});

  const currentDisclaimers = selectedProfile ? DISCLAIMERS[selectedProfile] : [];
  const currentDisclaimer = currentDisclaimers[disclaimerIndex];
  const allAcknowledged =
    currentDisclaimers.length > 0 &&
    currentDisclaimers.every((d) => acknowledged[d.id]);

  const handleProfileSelect = (profile: Scenario) => {
    setSelectedProfile(profile);
    setStep('disclaimers');
    setDisclaimerIndex(0);
    setAcknowledged({});
  };

  const handleAcknowledge = () => {
    if (currentDisclaimer) {
      setAcknowledged((prev) => ({
        ...prev,
        [currentDisclaimer.id]: true,
      }));

      if (disclaimerIndex < currentDisclaimers.length - 1) {
        setDisclaimerIndex((prev) => prev + 1);
      } else {
        setStep('complete');
      }
    }
  };

  const handleComplete = () => {
    // Save profile and redirect to monitor
    localStorage.setItem('safeos_profile', selectedProfile || 'pet');
    router.push('/monitor');
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Progress Indicator */}
      <div className="flex items-center justify-center gap-4 mb-8">
        {['Profile', 'Disclaimers', 'Complete'].map((label, index) => {
          const stepIndex =
            step === 'profile' ? 0 : step === 'disclaimers' ? 1 : 2;
          const isActive = index === stepIndex;
          const isComplete = index < stepIndex;

          return (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  isComplete
                    ? 'bg-safeos-500 text-white'
                    : isActive
                    ? 'bg-white text-black'
                    : 'bg-white/10 text-white/40'
                }`}
              >
                {isComplete ? '✓' : index + 1}
              </div>
              <span
                className={`text-sm ${
                  isActive ? 'text-white' : 'text-white/40'
                }`}
              >
                {label}
              </span>
              {index < 2 && (
                <div className="w-8 h-px bg-white/20 mx-2" />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      {step === 'profile' && (
        <div>
          <h2 className="text-2xl font-bold text-white text-center mb-2">
            Select Monitoring Profile
          </h2>
          <p className="text-white/60 text-center mb-8">
            Choose the type of monitoring that best fits your needs
          </p>
          <ProfileSelector onSelect={handleProfileSelect} selected={selectedProfile} />
        </div>
      )}

      {step === 'disclaimers' && currentDisclaimer && (
        <div>
          <h2 className="text-2xl font-bold text-white text-center mb-2">
            {currentDisclaimer.title}
          </h2>
          <p className="text-white/60 text-center mb-6">
            Step {disclaimerIndex + 1} of {currentDisclaimers.length}
          </p>

          <div className="disclaimer-box mb-6">{currentDisclaimer.content}</div>

          {currentDisclaimer.requiresAcknowledgment && (
            <div className="flex items-start gap-3 mb-6">
              <input
                type="checkbox"
                id="acknowledge"
                checked={acknowledged[currentDisclaimer.id] || false}
                onChange={(e) =>
                  setAcknowledged((prev) => ({
                    ...prev,
                    [currentDisclaimer.id]: e.target.checked,
                  }))
                }
                className="mt-1 w-5 h-5 rounded border-white/30 bg-white/10 text-safeos-500 focus:ring-safeos-500"
              />
              <label
                htmlFor="acknowledge"
                className="text-sm text-white/80 cursor-pointer"
              >
                {currentDisclaimer.acknowledgmentText}
              </label>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={() => {
                if (disclaimerIndex > 0) {
                  setDisclaimerIndex((prev) => prev - 1);
                } else {
                  setStep('profile');
                }
              }}
              className="flex-1 py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
            >
              Back
            </button>
            <button
              onClick={handleAcknowledge}
              disabled={
                currentDisclaimer.requiresAcknowledgment &&
                !acknowledged[currentDisclaimer.id]
              }
              className="flex-1 py-3 rounded-lg bg-safeos-500 hover:bg-safeos-600 text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {disclaimerIndex < currentDisclaimers.length - 1
                ? 'Continue'
                : 'I Understand'}
            </button>
          </div>
        </div>
      )}

      {step === 'complete' && (
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-safeos-500/20 flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-10 h-10 text-safeos-400"
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
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Setup Complete!</h2>
          <p className="text-white/60 mb-8">
            You&apos;ve acknowledged the important safety disclaimers. You can now start
            monitoring.
          </p>
          <button
            onClick={handleComplete}
            className="px-8 py-3 rounded-lg bg-safeos-500 hover:bg-safeos-600 text-white font-medium transition"
          >
            Start Monitoring
          </button>
        </div>
      )}
    </div>
  );
}


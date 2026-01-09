/**
 * Dashboard Page
 *
 * Main monitoring dashboard. Requires onboarding to be complete.
 * Redirects to /setup if user hasn't completed onboarding.
 *
 * @module app/dashboard/page
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore, canSkipOnboarding } from '../../stores/onboarding-store';
import Dashboard from '../../components/Dashboard';

export default function DashboardPage() {
  const router = useRouter();
  const onboardingState = useOnboardingStore();
  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    // Check if onboarding is complete
    if (!canSkipOnboarding(onboardingState)) {
      router.replace('/setup');
      return;
    }

    setChecking(false);
  }, [mounted, onboardingState, router]);

  // Show loading during hydration and auth check
  if (!mounted || checking) {
    return (
      <div className="min-h-screen bg-[var(--color-steel-950)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-[var(--color-steel-700)] border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-sm text-[var(--color-steel-500)]">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return <Dashboard />;
}

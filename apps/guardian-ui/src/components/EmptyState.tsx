/**
 * Empty State Component
 *
 * Reusable component for displaying empty states with illustrations.
 *
 * @module components/EmptyState
 */

'use client';

import React from 'react';

// =============================================================================
// Types
// =============================================================================

type EmptyStateType = 'no-alerts' | 'no-streams' | 'no-profiles' | 'no-data' | 'error' | 'loading';

interface EmptyStateProps {
  type: EmptyStateType;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

// =============================================================================
// SVG Illustrations
// =============================================================================

function NoAlertsIllustration() {
  return (
    <svg
      className="w-32 h-32 text-emerald-500/30"
      viewBox="0 0 128 128"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Shield with checkmark */}
      <path d="M64 12L20 32v32c0 26.5 18.7 51.2 44 56 25.3-4.8 44-29.5 44-56V32L64 12z" />
      <path d="M44 64l14 14 26-26" className="text-emerald-400" stroke="currentColor" strokeWidth="4" />
    </svg>
  );
}

function NoStreamsIllustration() {
  return (
    <svg
      className="w-32 h-32 text-slate-500/30"
      viewBox="0 0 128 128"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Camera icon */}
      <rect x="24" y="40" width="80" height="56" rx="8" />
      <circle cx="64" cy="68" r="16" />
      <circle cx="64" cy="68" r="8" />
      <rect x="92" y="48" width="8" height="8" rx="2" />
      {/* Diagonal line (offline) */}
      <line x1="20" y1="108" x2="108" y2="20" className="text-slate-600" strokeWidth="4" />
    </svg>
  );
}

function NoProfilesIllustration() {
  return (
    <svg
      className="w-32 h-32 text-slate-500/30"
      viewBox="0 0 128 128"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* User with plus */}
      <circle cx="52" cy="44" r="20" />
      <path d="M24 100c0-22 12.5-40 28-40s28 18 28 40" />
      {/* Plus sign */}
      <circle cx="96" cy="88" r="20" className="text-slate-600" />
      <line x1="96" y1="78" x2="96" y2="98" strokeWidth="3" />
      <line x1="86" y1="88" x2="106" y2="88" strokeWidth="3" />
    </svg>
  );
}

function NoDataIllustration() {
  return (
    <svg
      className="w-32 h-32 text-slate-500/30"
      viewBox="0 0 128 128"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Empty folder */}
      <path d="M20 32h32l8 8h48v68H20V32z" />
      <line x1="44" y1="72" x2="84" y2="72" strokeWidth="3" />
      <line x1="52" y1="84" x2="76" y2="84" strokeWidth="2" />
    </svg>
  );
}

function ErrorIllustration() {
  return (
    <svg
      className="w-32 h-32 text-red-500/30"
      viewBox="0 0 128 128"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Warning triangle */}
      <path d="M64 16L12 112h104L64 16z" />
      <line x1="64" y1="48" x2="64" y2="76" strokeWidth="4" />
      <circle cx="64" cy="92" r="4" fill="currentColor" />
    </svg>
  );
}

function LoadingIllustration() {
  return (
    <svg
      className="w-32 h-32 text-blue-500/30 animate-pulse"
      viewBox="0 0 128 128"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Loading spinner */}
      <circle cx="64" cy="64" r="40" strokeDasharray="200" strokeDashoffset="50" />
      <circle cx="64" cy="64" r="24" className="text-blue-400/50" />
    </svg>
  );
}

// =============================================================================
// Default Content
// =============================================================================

const defaultContent: Record<EmptyStateType, { title: string; description: string }> = {
  'no-alerts': {
    title: 'All Clear',
    description: 'No alerts detected. Your monitoring is active and everything looks good.',
  },
  'no-streams': {
    title: 'No Active Streams',
    description: 'Start a camera stream to begin monitoring.',
  },
  'no-profiles': {
    title: 'No Profiles Yet',
    description: 'Create a monitoring profile to customize your settings.',
  },
  'no-data': {
    title: 'No Data',
    description: 'There is nothing to display here yet.',
  },
  error: {
    title: 'Something Went Wrong',
    description: 'An error occurred while loading. Please try again.',
  },
  loading: {
    title: 'Loading...',
    description: 'Please wait while we fetch your data.',
  },
};

// =============================================================================
// Component
// =============================================================================

export function EmptyState({
  type,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  const content = defaultContent[type];

  const illustrations: Record<EmptyStateType, React.ReactNode> = {
    'no-alerts': <NoAlertsIllustration />,
    'no-streams': <NoStreamsIllustration />,
    'no-profiles': <NoProfilesIllustration />,
    'no-data': <NoDataIllustration />,
    error: <ErrorIllustration />,
    loading: <LoadingIllustration />,
  };

  return (
    <div
      className={`flex flex-col items-center justify-center text-center py-12 px-6 ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="mb-6">{illustrations[type]}</div>

      <h3 className="text-lg font-semibold text-white mb-2">
        {title || content.title}
      </h3>

      <p className="text-sm text-slate-400 max-w-sm mb-6">
        {description || content.description}
      </p>

      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// =============================================================================
// Convenience Components
// =============================================================================

export function NoAlertsState(props: Omit<EmptyStateProps, 'type'>) {
  return <EmptyState type="no-alerts" {...props} />;
}

export function NoStreamsState(props: Omit<EmptyStateProps, 'type'>) {
  return <EmptyState type="no-streams" {...props} />;
}

export function NoProfilesState(props: Omit<EmptyStateProps, 'type'>) {
  return <EmptyState type="no-profiles" {...props} />;
}

export function LoadingState(props: Omit<EmptyStateProps, 'type'>) {
  return <EmptyState type="loading" {...props} />;
}

export function ErrorState(props: Omit<EmptyStateProps, 'type'>) {
  return <EmptyState type="error" {...props} />;
}

export default EmptyState;

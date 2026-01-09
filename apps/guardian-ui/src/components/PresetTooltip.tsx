/**
 * Preset Tooltip Component
 *
 * Displays preset information on hover with pixel threshold,
 * processing mode, and quick description.
 *
 * @module components/PresetTooltip
 */

'use client';

import React, { useState, useRef, useCallback } from 'react';
import {
  DEFAULT_PRESETS,
  PresetId,
  isSleepPreset,
  getProcessingModeInfo,
} from '../stores/settings-store';

// =============================================================================
// Types
// =============================================================================

interface PresetTooltipProps {
  presetId: PresetId;
  children: React.ReactNode;
  /** Position of tooltip relative to trigger */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Delay before showing tooltip (ms) */
  delay?: number;
}

// =============================================================================
// Component
// =============================================================================

export function PresetTooltip({
  presetId,
  children,
  position = 'top',
  delay = 200,
}: PresetTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const preset = DEFAULT_PRESETS[presetId];
  const processingInfo = getProcessingModeInfo(preset.processingMode);
  const isSleep = isSleepPreset(presetId);

  const showTooltip = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  }, [delay]);

  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  }, []);

  // Position classes
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  // Arrow classes
  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-[var(--color-steel-800)] border-x-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-[var(--color-steel-800)] border-x-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-[var(--color-steel-800)] border-y-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-[var(--color-steel-800)] border-y-transparent border-l-transparent',
  };

  // Processing mode color mapping
  const processingColors = {
    green: 'text-emerald-400',
    amber: 'text-amber-400',
    blue: 'text-blue-400',
  };

  return (
    <div
      ref={triggerRef}
      className="relative inline-block"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}

      {/* Tooltip */}
      {isVisible && (
        <div
          role="tooltip"
          className={`
            absolute z-50 w-64 p-3
            bg-[var(--color-steel-800)] border border-[var(--color-steel-700)]
            rounded-lg shadow-xl
            ${positionClasses[position]}
            animate-in fade-in-0 zoom-in-95 duration-200
          `}
        >
          {/* Arrow */}
          <div
            className={`
              absolute w-0 h-0
              border-[6px]
              ${arrowClasses[position]}
            `}
          />

          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold text-[var(--color-steel-100)]">
              {preset.name}
            </span>
            {isSleep && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider
                              bg-purple-500/20 text-purple-400 rounded">
                Sleep Mode
              </span>
            )}
          </div>

          {/* Description */}
          <p className="text-xs text-[var(--color-steel-400)] mb-3 leading-relaxed">
            {preset.description}
          </p>

          {/* Stats Row */}
          <div className="flex items-center gap-3 text-xs">
            {/* Pixel Threshold */}
            {preset.useAbsoluteThreshold && (
              <div className="flex items-center gap-1">
                <span className="text-[var(--color-steel-500)]">Threshold:</span>
                <span className="font-mono text-emerald-400">
                  {preset.absolutePixelThreshold}px
                </span>
              </div>
            )}

            {/* Processing Mode */}
            <div className="flex items-center gap-1">
              <span className={`text-[10px] font-medium uppercase tracking-wider ${processingColors[processingInfo.color]}`}>
                {processingInfo.label}
              </span>
            </div>
          </div>

          {/* Interval & Delay */}
          <div className="mt-2 pt-2 border-t border-[var(--color-steel-700)] text-[10px] text-[var(--color-steel-500)]">
            <span>Check every {preset.analysisInterval}s</span>
            {preset.alertDelay > 0 && (
              <span className="ml-2">
                {preset.alertDelay}s delay before alert
              </span>
            )}
            {preset.alertDelay === 0 && (
              <span className="ml-2 text-amber-400">
                Instant alerts
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Inline Description Component (for use alongside preset names)
// =============================================================================

interface PresetInlineDescriptionProps {
  presetId: PresetId;
  showThreshold?: boolean;
  showProcessing?: boolean;
  className?: string;
}

export function PresetInlineDescription({
  presetId,
  showThreshold = true,
  showProcessing = true,
  className = '',
}: PresetInlineDescriptionProps) {
  const preset = DEFAULT_PRESETS[presetId];
  const processingInfo = getProcessingModeInfo(preset.processingMode);

  const processingColors = {
    green: 'text-emerald-400',
    amber: 'text-amber-400',
    blue: 'text-blue-400',
  };

  return (
    <div className={`text-xs text-[var(--color-steel-500)] ${className}`}>
      <p className="line-clamp-2">{preset.description}</p>
      <div className="flex items-center gap-2 mt-1">
        {showThreshold && preset.useAbsoluteThreshold && (
          <span className="font-mono text-emerald-400/70">
            {preset.absolutePixelThreshold}px
          </span>
        )}
        {showProcessing && (
          <span className={`text-[10px] uppercase ${processingColors[processingInfo.color]}/70`}>
            {processingInfo.label}
          </span>
        )}
      </div>
    </div>
  );
}

export default PresetTooltip;

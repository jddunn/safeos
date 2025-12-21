/**
 * Language Selector Component
 *
 * Dropdown for selecting the UI language.
 *
 * @module components/LanguageSelector
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useI18nStore, LANGUAGE_NAMES, type Locale } from '../lib/i18n';

// =============================================================================
// Types
// =============================================================================

interface LanguageSelectorProps {
  className?: string;
  variant?: 'dropdown' | 'inline';
}

// =============================================================================
// Component
// =============================================================================

export function LanguageSelector({ className = '', variant = 'dropdown' }: LanguageSelectorProps) {
  const { locale, setLocale } = useI18nStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const languages = Object.entries(LANGUAGE_NAMES) as [Locale, string][];

  if (variant === 'inline') {
    return (
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className={`bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm
          focus:ring-emerald-500 focus:border-emerald-500 ${className}`}
      >
        {languages.map(([code, name]) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-slate-700/50 hover:bg-slate-700 
          border border-slate-600 rounded-lg text-white text-sm transition-colors"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="text-base">🌐</span>
        <span>{LANGUAGE_NAMES[locale]}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 w-48 bg-slate-800 border border-slate-700 
            rounded-lg shadow-xl z-50 py-1 max-h-64 overflow-y-auto"
          role="listbox"
        >
          {languages.map(([code, name]) => (
            <button
              key={code}
              onClick={() => {
                setLocale(code);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700 transition-colors
                ${locale === code ? 'text-emerald-400 bg-slate-700/50' : 'text-white'}`}
              role="option"
              aria-selected={locale === code}
            >
              <span className="flex items-center gap-2">
                {locale === code && (
                  <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
                {name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default LanguageSelector;



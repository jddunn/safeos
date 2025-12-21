/**
 * Onboarding Store
 *
 * Zustand store for managing onboarding state.
 *
 * @module stores/onboarding-store
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// =============================================================================
// Types
// =============================================================================

export type MonitoringScenario = 'pet' | 'baby' | 'elderly';

interface OnboardingState {
  // Onboarding progress
  step: number;
  isOnboardingComplete: boolean;

  // Disclaimers
  acceptedDisclaimers: string[];
  disclaimerAcceptedAt: string | null;

  // Profile selection
  selectedScenarios: MonitoringScenario[];
  primaryScenario: MonitoringScenario | null;

  // Settings from onboarding
  notificationsEnabled: boolean;
  soundsEnabled: boolean;

  // Actions
  setStep: (step: number) => void;
  acceptDisclaimer: (disclaimerId: string) => void;
  acceptAllDisclaimers: (disclaimerIds: string[]) => void;
  selectScenario: (scenario: MonitoringScenario) => void;
  deselectScenario: (scenario: MonitoringScenario) => void;
  setPrimaryScenario: (scenario: MonitoringScenario) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setSoundsEnabled: (enabled: boolean) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

// =============================================================================
// Store
// =============================================================================

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      // Initial state
      step: 1,
      isOnboardingComplete: false,
      acceptedDisclaimers: [],
      disclaimerAcceptedAt: null,
      selectedScenarios: [],
      primaryScenario: null,
      notificationsEnabled: true,
      soundsEnabled: true,

      // Actions
      setStep: (step) => set({ step }),

      acceptDisclaimer: (disclaimerId) =>
        set((state) => {
          if (state.acceptedDisclaimers.includes(disclaimerId)) {
            return {
              acceptedDisclaimers: state.acceptedDisclaimers.filter(
                (id) => id !== disclaimerId
              ),
            };
          }
          return {
            acceptedDisclaimers: [...state.acceptedDisclaimers, disclaimerId],
          };
        }),

      acceptAllDisclaimers: (disclaimerIds) =>
        set({
          acceptedDisclaimers: disclaimerIds,
          disclaimerAcceptedAt: new Date().toISOString(),
        }),

      selectScenario: (scenario) =>
        set((state) => {
          if (state.selectedScenarios.includes(scenario)) {
            // Toggle off
            const newScenarios = state.selectedScenarios.filter((s) => s !== scenario);
            return {
              selectedScenarios: newScenarios,
              primaryScenario:
                state.primaryScenario === scenario
                  ? newScenarios[0] || null
                  : state.primaryScenario,
            };
          }
          // Toggle on
          const newScenarios = [...state.selectedScenarios, scenario];
          return {
            selectedScenarios: newScenarios,
            primaryScenario: state.primaryScenario || scenario,
          };
        }),

      deselectScenario: (scenario) =>
        set((state) => ({
          selectedScenarios: state.selectedScenarios.filter((s) => s !== scenario),
          primaryScenario:
            state.primaryScenario === scenario
              ? state.selectedScenarios.find((s) => s !== scenario) || null
              : state.primaryScenario,
        })),

      setPrimaryScenario: (scenario) => set({ primaryScenario: scenario }),

      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),

      setSoundsEnabled: (enabled) => set({ soundsEnabled: enabled }),

      completeOnboarding: () =>
        set({
          isOnboardingComplete: true,
          disclaimerAcceptedAt: new Date().toISOString(),
        }),

      resetOnboarding: () =>
        set({
          step: 1,
          isOnboardingComplete: false,
          acceptedDisclaimers: [],
          disclaimerAcceptedAt: null,
          selectedScenarios: [],
          primaryScenario: null,
        }),
    }),
    {
      name: 'safeos-onboarding',
      partialize: (state) => ({
        isOnboardingComplete: state.isOnboardingComplete,
        acceptedDisclaimers: state.acceptedDisclaimers,
        disclaimerAcceptedAt: state.disclaimerAcceptedAt,
        selectedScenarios: state.selectedScenarios,
        primaryScenario: state.primaryScenario,
        notificationsEnabled: state.notificationsEnabled,
        soundsEnabled: state.soundsEnabled,
      }),
    }
  )
);

// =============================================================================
// Selectors
// =============================================================================

export const selectIsOnboardingComplete = (state: OnboardingState) =>
  state.isOnboardingComplete;

export const selectPrimaryScenario = (state: OnboardingState) =>
  state.primaryScenario;

export const selectAcceptedDisclaimers = (state: OnboardingState) =>
  state.acceptedDisclaimers;

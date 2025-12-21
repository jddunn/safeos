/**
 * Onboarding Store
 *
 * Zustand state management for onboarding and setup flow.
 *
 * @module stores/onboarding-store
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// =============================================================================
// Types
// =============================================================================

export type OnboardingStep =
  | 'welcome'
  | 'disclaimers'
  | 'permissions'
  | 'profile'
  | 'notifications'
  | 'complete';

export interface DisclaimerAcceptance {
  supplementaryOnly: boolean;
  noMedicalAdvice: boolean;
  aiLimitations: boolean;
  privacyPolicy: boolean;
  termsOfService: boolean;
  allAccepted: boolean;
  acceptedAt: string | null;
}

export interface PermissionStatus {
  camera: 'pending' | 'granted' | 'denied';
  microphone: 'pending' | 'granted' | 'denied';
  notifications: 'pending' | 'granted' | 'denied' | 'default';
}

export interface SelectedProfile {
  scenario: 'pet' | 'baby' | 'elderly' | null;
  profileId: string | null;
  customSettings: {
    motionThreshold: number;
    audioThreshold: number;
    alertSpeed: 'slow' | 'normal' | 'fast' | 'immediate';
  } | null;
}

export interface NotificationSettings {
  browser: boolean;
  telegram: boolean;
  sms: boolean;
  telegramChatId: string | null;
  phoneNumber: string | null;
}

export interface OnboardingState {
  // Progress
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  isComplete: boolean;
  
  // Disclaimers
  disclaimers: DisclaimerAcceptance;
  
  // Permissions
  permissions: PermissionStatus;
  
  // Profile
  selectedProfile: SelectedProfile;
  
  // Notifications
  notificationSettings: NotificationSettings;
}

export interface OnboardingActions {
  // Navigation
  goToStep: (step: OnboardingStep) => void;
  nextStep: () => void;
  previousStep: () => void;
  completeStep: (step: OnboardingStep) => void;
  
  // Disclaimers
  acceptDisclaimer: (key: keyof Omit<DisclaimerAcceptance, 'allAccepted' | 'acceptedAt'>) => void;
  acceptAllDisclaimers: () => void;
  
  // Permissions
  setPermission: (type: keyof PermissionStatus, status: PermissionStatus[keyof PermissionStatus]) => void;
  requestPermissions: () => Promise<void>;
  
  // Profile
  setScenario: (scenario: 'pet' | 'baby' | 'elderly') => void;
  setProfileId: (profileId: string) => void;
  setCustomSettings: (settings: SelectedProfile['customSettings']) => void;
  
  // Notifications
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => void;
  
  // Reset
  reset: () => void;
  skipOnboarding: () => void;
}

// =============================================================================
// Step Order
// =============================================================================

const STEP_ORDER: OnboardingStep[] = [
  'welcome',
  'disclaimers',
  'permissions',
  'profile',
  'notifications',
  'complete',
];

// =============================================================================
// Initial State
// =============================================================================

const initialState: OnboardingState = {
  currentStep: 'welcome',
  completedSteps: [],
  isComplete: false,
  disclaimers: {
    supplementaryOnly: false,
    noMedicalAdvice: false,
    aiLimitations: false,
    privacyPolicy: false,
    termsOfService: false,
    allAccepted: false,
    acceptedAt: null,
  },
  permissions: {
    camera: 'pending',
    microphone: 'pending',
    notifications: 'pending',
  },
  selectedProfile: {
    scenario: null,
    profileId: null,
    customSettings: null,
  },
  notificationSettings: {
    browser: true,
    telegram: false,
    sms: false,
    telegramChatId: null,
    phoneNumber: null,
  },
};

// =============================================================================
// Store
// =============================================================================

export const useOnboardingStore = create<OnboardingState & OnboardingActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Navigation
      goToStep: (step) => set({ currentStep: step }),

      nextStep: () => {
        const { currentStep, completedSteps } = get();
        const currentIndex = STEP_ORDER.indexOf(currentStep);
        const nextIndex = currentIndex + 1;

        if (nextIndex < STEP_ORDER.length) {
          set({
            currentStep: STEP_ORDER[nextIndex],
            completedSteps: completedSteps.includes(currentStep)
              ? completedSteps
              : [...completedSteps, currentStep],
          });
        }
      },

      previousStep: () => {
        const { currentStep } = get();
        const currentIndex = STEP_ORDER.indexOf(currentStep);
        const prevIndex = currentIndex - 1;

        if (prevIndex >= 0) {
          set({ currentStep: STEP_ORDER[prevIndex] });
        }
      },

      completeStep: (step) =>
        set((state) => ({
          completedSteps: state.completedSteps.includes(step)
            ? state.completedSteps
            : [...state.completedSteps, step],
        })),

      // Disclaimers
      acceptDisclaimer: (key) =>
        set((state) => {
          const newDisclaimers = {
            ...state.disclaimers,
            [key]: true,
          };

          const allAccepted =
            newDisclaimers.supplementaryOnly &&
            newDisclaimers.noMedicalAdvice &&
            newDisclaimers.aiLimitations &&
            newDisclaimers.privacyPolicy &&
            newDisclaimers.termsOfService;

          return {
            disclaimers: {
              ...newDisclaimers,
              allAccepted,
              acceptedAt: allAccepted ? new Date().toISOString() : null,
            },
          };
        }),

      acceptAllDisclaimers: () =>
        set({
          disclaimers: {
            supplementaryOnly: true,
            noMedicalAdvice: true,
            aiLimitations: true,
            privacyPolicy: true,
            termsOfService: true,
            allAccepted: true,
            acceptedAt: new Date().toISOString(),
          },
        }),

      // Permissions
      setPermission: (type, status) =>
        set((state) => ({
          permissions: {
            ...state.permissions,
            [type]: status,
          },
        })),

      requestPermissions: async () => {
        try {
          // Request camera and microphone
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });

          // Stop tracks immediately - we just wanted permission
          stream.getTracks().forEach((track) => track.stop());

          set((state) => ({
            permissions: {
              ...state.permissions,
              camera: 'granted',
              microphone: 'granted',
            },
          }));
        } catch (error) {
          set((state) => ({
            permissions: {
              ...state.permissions,
              camera: 'denied',
              microphone: 'denied',
            },
          }));
        }

        // Request notification permission
        if ('Notification' in window) {
          const permission = await Notification.requestPermission();
          set((state) => ({
            permissions: {
              ...state.permissions,
              notifications: permission,
            },
          }));
        }
      },

      // Profile
      setScenario: (scenario) =>
        set((state) => ({
          selectedProfile: {
            ...state.selectedProfile,
            scenario,
          },
        })),

      setProfileId: (profileId) =>
        set((state) => ({
          selectedProfile: {
            ...state.selectedProfile,
            profileId,
          },
        })),

      setCustomSettings: (settings) =>
        set((state) => ({
          selectedProfile: {
            ...state.selectedProfile,
            customSettings: settings,
          },
        })),

      // Notifications
      updateNotificationSettings: (settings) =>
        set((state) => ({
          notificationSettings: {
            ...state.notificationSettings,
            ...settings,
          },
        })),

      // Reset
      reset: () => set(initialState),

      skipOnboarding: () =>
        set({
          isComplete: true,
          currentStep: 'complete',
          completedSteps: STEP_ORDER,
        }),
    }),
    {
      name: 'safeos-onboarding-store',
    }
  )
);


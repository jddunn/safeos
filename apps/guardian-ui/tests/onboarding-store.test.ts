/**
 * Onboarding Store Tests
 *
 * Unit tests for onboarding state management and helpers.
 *
 * @module tests/onboarding-store.test
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// =============================================================================
// Types (extracted from store)
// =============================================================================

type Scenario = 'pet' | 'baby' | 'elderly' | 'security' | null;

interface AcceptedDisclaimers {
  main: boolean;
  scenario: boolean;
  privacy: boolean;
  terms: boolean;
}

interface NotificationSettings {
  notificationsEnabled: boolean;
  browserPushEnabled: boolean;
  smsEnabled: boolean;
  telegramEnabled: boolean;
  telegramChatId: string | null;
}

// =============================================================================
// Constants (extracted from store)
// =============================================================================

const INITIAL_DISCLAIMERS: AcceptedDisclaimers = {
  main: false,
  scenario: false,
  privacy: false,
  terms: false,
};

// =============================================================================
// Helper Functions (extracted from store)
// =============================================================================

function getOnboardingSteps() {
  return [
    {
      id: 0,
      name: 'Welcome',
      description: 'Introduction to SafeOS Guardian',
      required: true,
    },
    {
      id: 1,
      name: 'Safety Disclaimer',
      description: 'Read and accept important safety information',
      required: true,
    },
    {
      id: 2,
      name: 'Select Scenario',
      description: 'Choose what you want to monitor',
      required: true,
    },
    {
      id: 3,
      name: 'Camera Access',
      description: 'Grant camera and microphone permissions',
      required: true,
    },
    {
      id: 4,
      name: 'Notifications',
      description: 'Set up alert notifications',
      required: false,
    },
    {
      id: 5,
      name: 'Ready',
      description: 'Start monitoring',
      required: false,
    },
  ];
}

function areDisclaimersAccepted(disclaimers: AcceptedDisclaimers): boolean {
  return disclaimers.main && disclaimers.scenario;
}

interface OnboardingStateForSkipCheck {
  isComplete: boolean;
  acceptedDisclaimers: AcceptedDisclaimers;
  selectedScenario: Scenario;
}

function canSkipOnboarding(state: OnboardingStateForSkipCheck): boolean {
  return (
    state.isComplete &&
    areDisclaimersAccepted(state.acceptedDisclaimers) &&
    state.selectedScenario !== null
  );
}

// =============================================================================
// Mock Store Class
// =============================================================================

class OnboardingStore {
  // Onboarding progress
  currentStep: number = 0;
  completedSteps: number[] = [];
  isComplete: boolean = false;

  // Disclaimers
  acceptedDisclaimers: AcceptedDisclaimers = { ...INITIAL_DISCLAIMERS };
  disclaimerAcceptedAt: string | null = null;

  // Profile selection
  selectedScenario: Scenario = null;
  profileName: string = '';

  // Notifications
  notificationsEnabled: boolean = true;
  browserPushEnabled: boolean = false;
  smsEnabled: boolean = false;
  telegramEnabled: boolean = false;
  telegramChatId: string | null = null;

  // Camera permissions
  cameraPermissionGranted: boolean = false;
  microphonePermissionGranted: boolean = false;

  // Actions
  setStep(step: number): void {
    this.currentStep = step;
  }

  completeStep(step: number): void {
    if (!this.completedSteps.includes(step)) {
      this.completedSteps = [...this.completedSteps, step];
    }
    this.currentStep = Math.max(this.currentStep, step + 1);
  }

  setComplete(complete: boolean): void {
    this.isComplete = complete;
  }

  acceptDisclaimer(type: keyof AcceptedDisclaimers): void {
    this.acceptedDisclaimers = {
      ...this.acceptedDisclaimers,
      [type]: true,
    };
    this.disclaimerAcceptedAt = new Date().toISOString();
  }

  acceptAllDisclaimers(): void {
    this.acceptedDisclaimers = {
      main: true,
      scenario: true,
      privacy: true,
      terms: true,
    };
    this.disclaimerAcceptedAt = new Date().toISOString();
  }

  setScenario(scenario: Scenario): void {
    this.selectedScenario = scenario;
  }

  setProfileName(name: string): void {
    this.profileName = name;
  }

  setNotifications(settings: Partial<NotificationSettings>): void {
    if (settings.notificationsEnabled !== undefined) {
      this.notificationsEnabled = settings.notificationsEnabled;
    }
    if (settings.browserPushEnabled !== undefined) {
      this.browserPushEnabled = settings.browserPushEnabled;
    }
    if (settings.smsEnabled !== undefined) {
      this.smsEnabled = settings.smsEnabled;
    }
    if (settings.telegramEnabled !== undefined) {
      this.telegramEnabled = settings.telegramEnabled;
    }
    if (settings.telegramChatId !== undefined) {
      this.telegramChatId = settings.telegramChatId;
    }
  }

  setCameraPermission(granted: boolean): void {
    this.cameraPermissionGranted = granted;
  }

  setMicrophonePermission(granted: boolean): void {
    this.microphonePermissionGranted = granted;
  }

  reset(): void {
    this.currentStep = 0;
    this.completedSteps = [];
    this.isComplete = false;
    this.acceptedDisclaimers = { ...INITIAL_DISCLAIMERS };
    this.disclaimerAcceptedAt = null;
    this.selectedScenario = null;
    this.profileName = '';
    this.notificationsEnabled = true;
    this.browserPushEnabled = false;
    this.smsEnabled = false;
    this.telegramEnabled = false;
    this.telegramChatId = null;
    this.cameraPermissionGranted = false;
    this.microphonePermissionGranted = false;
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('Onboarding Store', () => {
  let store: OnboardingStore;

  beforeEach(() => {
    store = new OnboardingStore();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  describe('getOnboardingSteps', () => {
    it('should return 6 onboarding steps', () => {
      const steps = getOnboardingSteps();
      expect(steps).toHaveLength(6);
    });

    it('should have sequential IDs starting from 0', () => {
      const steps = getOnboardingSteps();
      steps.forEach((step, index) => {
        expect(step.id).toBe(index);
      });
    });

    it('should mark first 4 steps as required', () => {
      const steps = getOnboardingSteps();
      expect(steps[0].required).toBe(true);
      expect(steps[1].required).toBe(true);
      expect(steps[2].required).toBe(true);
      expect(steps[3].required).toBe(true);
    });

    it('should mark last 2 steps as optional', () => {
      const steps = getOnboardingSteps();
      expect(steps[4].required).toBe(false);
      expect(steps[5].required).toBe(false);
    });

    it('should have correct step names', () => {
      const steps = getOnboardingSteps();
      const names = steps.map((s) => s.name);
      expect(names).toEqual([
        'Welcome',
        'Safety Disclaimer',
        'Select Scenario',
        'Camera Access',
        'Notifications',
        'Ready',
      ]);
    });

    it('should have descriptions for all steps', () => {
      const steps = getOnboardingSteps();
      steps.forEach((step) => {
        expect(step.description).toBeTruthy();
        expect(typeof step.description).toBe('string');
      });
    });
  });

  describe('areDisclaimersAccepted', () => {
    it('should return false when no disclaimers accepted', () => {
      expect(areDisclaimersAccepted(INITIAL_DISCLAIMERS)).toBe(false);
    });

    it('should return false when only main accepted', () => {
      expect(
        areDisclaimersAccepted({
          main: true,
          scenario: false,
          privacy: false,
          terms: false,
        })
      ).toBe(false);
    });

    it('should return false when only scenario accepted', () => {
      expect(
        areDisclaimersAccepted({
          main: false,
          scenario: true,
          privacy: false,
          terms: false,
        })
      ).toBe(false);
    });

    it('should return true when main and scenario accepted', () => {
      expect(
        areDisclaimersAccepted({
          main: true,
          scenario: true,
          privacy: false,
          terms: false,
        })
      ).toBe(true);
    });

    it('should return true when all disclaimers accepted', () => {
      expect(
        areDisclaimersAccepted({
          main: true,
          scenario: true,
          privacy: true,
          terms: true,
        })
      ).toBe(true);
    });

    it('should ignore privacy and terms for required check', () => {
      expect(
        areDisclaimersAccepted({
          main: true,
          scenario: true,
          privacy: false,
          terms: false,
        })
      ).toBe(true);
    });
  });

  describe('canSkipOnboarding', () => {
    it('should return false when onboarding not complete', () => {
      expect(
        canSkipOnboarding({
          isComplete: false,
          acceptedDisclaimers: { main: true, scenario: true, privacy: true, terms: true },
          selectedScenario: 'pet',
        })
      ).toBe(false);
    });

    it('should return false when disclaimers not accepted', () => {
      expect(
        canSkipOnboarding({
          isComplete: true,
          acceptedDisclaimers: INITIAL_DISCLAIMERS,
          selectedScenario: 'pet',
        })
      ).toBe(false);
    });

    it('should return false when no scenario selected', () => {
      expect(
        canSkipOnboarding({
          isComplete: true,
          acceptedDisclaimers: { main: true, scenario: true, privacy: true, terms: true },
          selectedScenario: null,
        })
      ).toBe(false);
    });

    it('should return true when all conditions met', () => {
      expect(
        canSkipOnboarding({
          isComplete: true,
          acceptedDisclaimers: { main: true, scenario: true, privacy: false, terms: false },
          selectedScenario: 'baby',
        })
      ).toBe(true);
    });

    it('should work with all scenario types', () => {
      const scenarios: Scenario[] = ['pet', 'baby', 'elderly', 'security'];
      scenarios.forEach((scenario) => {
        expect(
          canSkipOnboarding({
            isComplete: true,
            acceptedDisclaimers: { main: true, scenario: true, privacy: true, terms: true },
            selectedScenario: scenario,
          })
        ).toBe(true);
      });
    });
  });

  describe('INITIAL_DISCLAIMERS', () => {
    it('should have all disclaimers set to false', () => {
      expect(INITIAL_DISCLAIMERS.main).toBe(false);
      expect(INITIAL_DISCLAIMERS.scenario).toBe(false);
      expect(INITIAL_DISCLAIMERS.privacy).toBe(false);
      expect(INITIAL_DISCLAIMERS.terms).toBe(false);
    });
  });

  describe('Initial State', () => {
    it('should start at step 0', () => {
      expect(store.currentStep).toBe(0);
    });

    it('should have no completed steps', () => {
      expect(store.completedSteps).toEqual([]);
    });

    it('should not be complete', () => {
      expect(store.isComplete).toBe(false);
    });

    it('should have no accepted disclaimers', () => {
      expect(store.acceptedDisclaimers).toEqual(INITIAL_DISCLAIMERS);
    });

    it('should have null disclaimer accepted timestamp', () => {
      expect(store.disclaimerAcceptedAt).toBeNull();
    });

    it('should have no selected scenario', () => {
      expect(store.selectedScenario).toBeNull();
    });

    it('should have empty profile name', () => {
      expect(store.profileName).toBe('');
    });

    it('should have notifications enabled by default', () => {
      expect(store.notificationsEnabled).toBe(true);
    });

    it('should have browser push disabled by default', () => {
      expect(store.browserPushEnabled).toBe(false);
    });

    it('should have SMS disabled by default', () => {
      expect(store.smsEnabled).toBe(false);
    });

    it('should have Telegram disabled by default', () => {
      expect(store.telegramEnabled).toBe(false);
      expect(store.telegramChatId).toBeNull();
    });

    it('should not have camera permission', () => {
      expect(store.cameraPermissionGranted).toBe(false);
    });

    it('should not have microphone permission', () => {
      expect(store.microphonePermissionGranted).toBe(false);
    });
  });

  describe('setStep', () => {
    it('should set current step', () => {
      store.setStep(3);
      expect(store.currentStep).toBe(3);
    });

    it('should allow setting to any step', () => {
      store.setStep(5);
      expect(store.currentStep).toBe(5);

      store.setStep(0);
      expect(store.currentStep).toBe(0);
    });

    it('should not affect completed steps', () => {
      store.completedSteps = [0, 1, 2];
      store.setStep(1);
      expect(store.completedSteps).toEqual([0, 1, 2]);
    });
  });

  describe('completeStep', () => {
    it('should add step to completed steps', () => {
      store.completeStep(0);
      expect(store.completedSteps).toContain(0);
    });

    it('should advance current step', () => {
      store.completeStep(0);
      expect(store.currentStep).toBe(1);
    });

    it('should not duplicate completed steps', () => {
      store.completeStep(0);
      store.completeStep(0);
      expect(store.completedSteps).toEqual([0]);
    });

    it('should not decrease current step', () => {
      store.setStep(3);
      store.completeStep(1);
      expect(store.currentStep).toBe(3);
    });

    it('should complete steps in any order', () => {
      store.completeStep(2);
      store.completeStep(0);
      store.completeStep(1);
      expect(store.completedSteps).toContain(0);
      expect(store.completedSteps).toContain(1);
      expect(store.completedSteps).toContain(2);
    });
  });

  describe('setComplete', () => {
    it('should set onboarding as complete', () => {
      store.setComplete(true);
      expect(store.isComplete).toBe(true);
    });

    it('should allow setting back to incomplete', () => {
      store.setComplete(true);
      store.setComplete(false);
      expect(store.isComplete).toBe(false);
    });
  });

  describe('acceptDisclaimer', () => {
    it('should accept main disclaimer', () => {
      store.acceptDisclaimer('main');
      expect(store.acceptedDisclaimers.main).toBe(true);
    });

    it('should accept scenario disclaimer', () => {
      store.acceptDisclaimer('scenario');
      expect(store.acceptedDisclaimers.scenario).toBe(true);
    });

    it('should accept privacy disclaimer', () => {
      store.acceptDisclaimer('privacy');
      expect(store.acceptedDisclaimers.privacy).toBe(true);
    });

    it('should accept terms disclaimer', () => {
      store.acceptDisclaimer('terms');
      expect(store.acceptedDisclaimers.terms).toBe(true);
    });

    it('should set disclaimer accepted timestamp', () => {
      store.acceptDisclaimer('main');
      expect(store.disclaimerAcceptedAt).toBe('2024-01-15T12:00:00.000Z');
    });

    it('should preserve other disclaimers', () => {
      store.acceptDisclaimer('main');
      store.acceptDisclaimer('privacy');
      expect(store.acceptedDisclaimers.main).toBe(true);
      expect(store.acceptedDisclaimers.privacy).toBe(true);
      expect(store.acceptedDisclaimers.scenario).toBe(false);
    });
  });

  describe('acceptAllDisclaimers', () => {
    it('should accept all disclaimers', () => {
      store.acceptAllDisclaimers();
      expect(store.acceptedDisclaimers).toEqual({
        main: true,
        scenario: true,
        privacy: true,
        terms: true,
      });
    });

    it('should set disclaimer accepted timestamp', () => {
      store.acceptAllDisclaimers();
      expect(store.disclaimerAcceptedAt).toBe('2024-01-15T12:00:00.000Z');
    });
  });

  describe('setScenario', () => {
    it('should set pet scenario', () => {
      store.setScenario('pet');
      expect(store.selectedScenario).toBe('pet');
    });

    it('should set baby scenario', () => {
      store.setScenario('baby');
      expect(store.selectedScenario).toBe('baby');
    });

    it('should set elderly scenario', () => {
      store.setScenario('elderly');
      expect(store.selectedScenario).toBe('elderly');
    });

    it('should set security scenario', () => {
      store.setScenario('security');
      expect(store.selectedScenario).toBe('security');
    });

    it('should allow clearing scenario', () => {
      store.setScenario('pet');
      store.setScenario(null);
      expect(store.selectedScenario).toBeNull();
    });
  });

  describe('setProfileName', () => {
    it('should set profile name', () => {
      store.setProfileName('Living Room Camera');
      expect(store.profileName).toBe('Living Room Camera');
    });

    it('should allow empty name', () => {
      store.setProfileName('Test');
      store.setProfileName('');
      expect(store.profileName).toBe('');
    });
  });

  describe('setNotifications', () => {
    it('should enable browser push', () => {
      store.setNotifications({ browserPushEnabled: true });
      expect(store.browserPushEnabled).toBe(true);
    });

    it('should enable SMS', () => {
      store.setNotifications({ smsEnabled: true });
      expect(store.smsEnabled).toBe(true);
    });

    it('should enable Telegram with chat ID', () => {
      store.setNotifications({
        telegramEnabled: true,
        telegramChatId: '123456789',
      });
      expect(store.telegramEnabled).toBe(true);
      expect(store.telegramChatId).toBe('123456789');
    });

    it('should disable all notifications', () => {
      store.setNotifications({
        notificationsEnabled: false,
        browserPushEnabled: false,
        smsEnabled: false,
        telegramEnabled: false,
      });
      expect(store.notificationsEnabled).toBe(false);
      expect(store.browserPushEnabled).toBe(false);
      expect(store.smsEnabled).toBe(false);
      expect(store.telegramEnabled).toBe(false);
    });

    it('should preserve unspecified settings', () => {
      store.setNotifications({ smsEnabled: true });
      store.setNotifications({ browserPushEnabled: true });
      expect(store.smsEnabled).toBe(true);
      expect(store.browserPushEnabled).toBe(true);
    });
  });

  describe('setCameraPermission', () => {
    it('should grant camera permission', () => {
      store.setCameraPermission(true);
      expect(store.cameraPermissionGranted).toBe(true);
    });

    it('should revoke camera permission', () => {
      store.setCameraPermission(true);
      store.setCameraPermission(false);
      expect(store.cameraPermissionGranted).toBe(false);
    });
  });

  describe('setMicrophonePermission', () => {
    it('should grant microphone permission', () => {
      store.setMicrophonePermission(true);
      expect(store.microphonePermissionGranted).toBe(true);
    });

    it('should revoke microphone permission', () => {
      store.setMicrophonePermission(true);
      store.setMicrophonePermission(false);
      expect(store.microphonePermissionGranted).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      // Modify all state
      store.setStep(3);
      store.completeStep(0);
      store.completeStep(1);
      store.setComplete(true);
      store.acceptAllDisclaimers();
      store.setScenario('baby');
      store.setProfileName('Test Camera');
      store.setNotifications({
        browserPushEnabled: true,
        smsEnabled: true,
        telegramEnabled: true,
        telegramChatId: '12345',
      });
      store.setCameraPermission(true);
      store.setMicrophonePermission(true);

      // Reset
      store.reset();

      // Verify all reset
      expect(store.currentStep).toBe(0);
      expect(store.completedSteps).toEqual([]);
      expect(store.isComplete).toBe(false);
      expect(store.acceptedDisclaimers).toEqual(INITIAL_DISCLAIMERS);
      expect(store.disclaimerAcceptedAt).toBeNull();
      expect(store.selectedScenario).toBeNull();
      expect(store.profileName).toBe('');
      expect(store.notificationsEnabled).toBe(true);
      expect(store.browserPushEnabled).toBe(false);
      expect(store.smsEnabled).toBe(false);
      expect(store.telegramEnabled).toBe(false);
      expect(store.telegramChatId).toBeNull();
      expect(store.cameraPermissionGranted).toBe(false);
      expect(store.microphonePermissionGranted).toBe(false);
    });

    it('should restore default notification enabled state', () => {
      store.setNotifications({ notificationsEnabled: false });
      store.reset();
      expect(store.notificationsEnabled).toBe(true);
    });
  });

  describe('Full Onboarding Flow', () => {
    it('should complete full onboarding flow', () => {
      // Step 0: Welcome
      store.completeStep(0);
      expect(store.currentStep).toBe(1);

      // Step 1: Disclaimers
      store.acceptAllDisclaimers();
      store.completeStep(1);
      expect(store.currentStep).toBe(2);

      // Step 2: Scenario
      store.setScenario('baby');
      store.setProfileName('Nursery Camera');
      store.completeStep(2);
      expect(store.currentStep).toBe(3);

      // Step 3: Camera
      store.setCameraPermission(true);
      store.setMicrophonePermission(true);
      store.completeStep(3);
      expect(store.currentStep).toBe(4);

      // Step 4: Notifications
      store.setNotifications({ browserPushEnabled: true });
      store.completeStep(4);
      expect(store.currentStep).toBe(5);

      // Step 5: Ready
      store.completeStep(5);
      store.setComplete(true);

      // Verify final state
      expect(store.isComplete).toBe(true);
      expect(store.completedSteps).toEqual([0, 1, 2, 3, 4, 5]);
      expect(areDisclaimersAccepted(store.acceptedDisclaimers)).toBe(true);
      expect(store.selectedScenario).toBe('baby');
      expect(store.cameraPermissionGranted).toBe(true);
    });

    it('should allow skipping optional steps', () => {
      // Complete required steps only
      store.completeStep(0);
      store.acceptAllDisclaimers();
      store.completeStep(1);
      store.setScenario('pet');
      store.completeStep(2);
      store.setCameraPermission(true);
      store.completeStep(3);
      store.setComplete(true);

      // Should be able to skip onboarding
      expect(
        canSkipOnboarding({
          isComplete: store.isComplete,
          acceptedDisclaimers: store.acceptedDisclaimers,
          selectedScenario: store.selectedScenario,
        })
      ).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle completing same step multiple times', () => {
      store.completeStep(0);
      store.completeStep(0);
      store.completeStep(0);
      expect(store.completedSteps.filter((s) => s === 0)).toHaveLength(1);
    });

    it('should handle completing steps out of order', () => {
      store.completeStep(3);
      store.completeStep(1);
      store.completeStep(4);
      expect(store.completedSteps).toContain(1);
      expect(store.completedSteps).toContain(3);
      expect(store.completedSteps).toContain(4);
    });

    it('should handle setting same scenario multiple times', () => {
      store.setScenario('pet');
      store.setScenario('baby');
      store.setScenario('pet');
      expect(store.selectedScenario).toBe('pet');
    });

    it('should handle accepting same disclaimer multiple times', () => {
      store.acceptDisclaimer('main');
      store.acceptDisclaimer('main');
      expect(store.acceptedDisclaimers.main).toBe(true);
    });
  });
});

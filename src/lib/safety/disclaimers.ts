/**
 * Legal Disclaimers
 *
 * Critical legal text that must be displayed and accepted
 * before using SafeOS.
 *
 * @module lib/safety/disclaimers
 */

// =============================================================================
// Main Disclaimer
// =============================================================================

export const CRITICAL_DISCLAIMER = `
⚠️ IMPORTANT SAFETY NOTICE - PLEASE READ CAREFULLY ⚠️

SafeOS is a SUPPLEMENTARY monitoring tool provided FREE OF CHARGE by SuperCloud as part of our humanitarian mission.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    NOT A REPLACEMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This service is NOT intended to replace:
• Professional medical care or monitoring
• Parental supervision or childcare
• Professional elderly care services
• Veterinary care or pet supervision
• Emergency services (911)
• Any form of professional caregiving

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                   LIMITATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• AI systems can make mistakes
• Technology can fail (power outages, network issues)
• Detection is not 100% accurate
• There may be delays in alerts
• This service may be unavailable at times

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                YOUR RESPONSIBILITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

By using SafeOS, you acknowledge that:

1. You remain FULLY RESPONSIBLE for the care and safety of those you monitor
2. This is a supplementary tool, not a primary care solution
3. You will NOT leave dependents unsupervised based solely on this service
4. You will maintain appropriate professional care arrangements
5. You will respond promptly to any concerns, regardless of alerts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                 LIABILITY WAIVER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SuperCloud and SafeOS are NOT LIABLE for:
• Any harm, injury, or death
• Property damage
• Missed alerts or false alarms
• Service interruptions
• Any consequences of using or relying on this service

USE AT YOUR OWN RISK.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                  EMERGENCY CONTACT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

In case of emergency, ALWAYS call:
• 911 (Emergency Services)
• Your local emergency number
• Professional medical/care services

Do NOT rely on SafeOS for emergencies.
`.trim();

// =============================================================================
// Scenario-Specific Disclaimers
// =============================================================================

export const BABY_MONITORING_DISCLAIMER = `
👶 BABY/CHILD MONITORING NOTICE

This service is intended to SUPPLEMENT, not replace, parental supervision.

NEVER:
• Leave a baby/child completely unsupervised
• Use this as a primary baby monitor
• Assume no alerts means everything is fine
• Delay checking on your child because of this service

ALWAYS:
• Maintain direct supervision or qualified childcare
• Check on your child regularly regardless of alerts
• Have emergency contacts readily available
• Follow safe sleep guidelines and child safety practices

Parents and guardians remain solely responsible for child safety.
`.trim();

export const ELDERLY_MONITORING_DISCLAIMER = `
🧓 ELDERLY CARE NOTICE

This service is intended to SUPPLEMENT professional elderly care.

THIS CANNOT:
• Provide medical monitoring
• Replace in-home care services
• Detect all medical emergencies
• Provide immediate assistance

RECOMMENDED:
• Medical alert systems (Life Alert, etc.)
• Regular check-ins by family or professionals
• Professional home care if needed
• Emergency response plans

Families and caregivers remain solely responsible for elderly care decisions.
`.trim();

export const PET_MONITORING_DISCLAIMER = `
🐾 PET MONITORING NOTICE

This service provides basic visual monitoring for pets.

THIS CANNOT:
• Detect all pet emergencies
• Replace veterinary care
• Provide food, water, or medication
• Open doors or provide access to outside

PET OWNERS MUST:
• Ensure pets have adequate food, water, and shelter
• Arrange for pet care during extended absences
• Maintain regular veterinary check-ups
• Have emergency vet contacts available

Pet owners remain solely responsible for pet welfare.
`.trim();

// =============================================================================
// Privacy Disclaimer
// =============================================================================

export const PRIVACY_DISCLAIMER = `
🔒 PRIVACY & DATA NOTICE

HOW WE HANDLE YOUR DATA:

✅ What we do:
• Process video locally on your device when possible
• Use rolling buffers that automatically delete old footage
• Anonymize data before any human review
• Encrypt all transmissions

❌ What we DON'T do:
• Store video permanently
• Share your data with third parties
• Sell your information
• Access your camera without permission

HUMAN REVIEW:
• Flagged content may be reviewed by trained moderators
• All content is anonymized/blurred before review
• Review is only for safety verification
• Reviewers cannot identify you or your location

DATA RETENTION:
• Live video: 5-10 minute rolling buffer
• Alert history: 30 days
• Anonymized analytics: Aggregated only

You can request data deletion at any time.
`.trim();

// =============================================================================
// Abuse Prevention Disclaimer
// =============================================================================

export const ABUSE_PREVENTION_DISCLAIMER = `
🛡️ ABUSE PREVENTION NOTICE

SafeOS is designed to PROTECT, not enable harm.

OUR COMMITMENT:
• AI-powered abuse detection
• Multi-tier content moderation
• Human review for edge cases
• Zero tolerance for harmful content

IF ABUSE IS DETECTED:
1. Content is immediately blocked
2. Appropriate authorities may be notified
3. Account may be permanently banned
4. IP and usage data may be preserved for law enforcement

WE WILL COOPERATE with law enforcement for:
• Child abuse or endangerment
• Animal cruelty
• Violence or threats
• Other serious criminal activity

This service monitors for the SAFETY of those being watched.
Misuse will not be tolerated.
`.trim();

// =============================================================================
// Terms of Service Summary
// =============================================================================

export const TERMS_SUMMARY = `
📜 BY USING SAFEOS, YOU AGREE:

1. I understand this is NOT a replacement for proper care
2. I remain fully responsible for those I monitor
3. I will not leave dependents completely unsupervised
4. I accept that technology can fail
5. I waive all liability claims against SuperCloud
6. I consent to AI-powered content moderation
7. I understand flagged content may be human-reviewed
8. I will use this service legally and ethically
9. I will call 911 for actual emergencies
10. I have read and understand all disclaimers

This is a FREE service provided as-is without warranty.
`.trim();

// =============================================================================
// Consent Checkboxes (for UI)
// =============================================================================

export const CONSENT_ITEMS = [
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

// =============================================================================
// Helper Functions
// =============================================================================

export function getScenarioDisclaimer(
  scenario: 'baby' | 'pet' | 'elderly'
): string {
  switch (scenario) {
    case 'baby':
      return BABY_MONITORING_DISCLAIMER;
    case 'pet':
      return PET_MONITORING_DISCLAIMER;
    case 'elderly':
      return ELDERLY_MONITORING_DISCLAIMER;
  }
}

export function getAllDisclaimers(): {
  critical: string;
  privacy: string;
  abusePrevention: string;
  terms: string;
  baby: string;
  elderly: string;
  pet: string;
} {
  return {
    critical: CRITICAL_DISCLAIMER,
    privacy: PRIVACY_DISCLAIMER,
    abusePrevention: ABUSE_PREVENTION_DISCLAIMER,
    terms: TERMS_SUMMARY,
    baby: BABY_MONITORING_DISCLAIMER,
    elderly: ELDERLY_MONITORING_DISCLAIMER,
    pet: PET_MONITORING_DISCLAIMER,
  };
}

export function validateConsent(
  acceptedIds: string[]
): { valid: boolean; missing: string[] } {
  const requiredIds = CONSENT_ITEMS.filter((item) => item.required).map((item) => item.id);

  const missing = requiredIds.filter((id) => !acceptedIds.includes(id));

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Legal Disclaimers and Terms of Service
 *
 * CRITICAL: These disclaimers must be shown to users during onboarding
 * and must be acknowledged before using the service.
 *
 * @module lib/safety/disclaimers
 */

// =============================================================================
// Critical Disclaimers
// =============================================================================

export const CRITICAL_DISCLAIMER = `
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              IMPORTANT NOTICE                                 ║
║                                                                               ║
║  SAFEOS IS A SUPPLEMENTARY MONITORING TOOL ONLY.                             ║
║                                                                               ║
║  This service:                                                                ║
║  • Does NOT replace in-person care, supervision, or medical attention         ║
║  • Does NOT guarantee detection of all events or emergencies                  ║
║  • May experience delays, outages, or missed detections                       ║
║  • Uses AI that can make mistakes and miss important events                   ║
║                                                                               ║
║  You MUST maintain appropriate human supervision at all times.                ║
║                                                                               ║
║  By using this service, you acknowledge and accept these limitations.         ║
╚═══════════════════════════════════════════════════════════════════════════════╝
`;

export const BABY_DISCLAIMER = `
BABY/TODDLER MONITORING DISCLAIMER

SafeOS is NOT a replacement for parental supervision.

• This is NOT a medical device
• This is NOT a certified baby monitor
• This does NOT replace the need for a parent/caregiver to be present
• AI detection may fail to identify dangerous situations
• Network or power failures may interrupt monitoring

NEVER leave a baby or toddler unattended based solely on this service.
Always follow safe sleep guidelines from pediatric organizations.
In any emergency, call emergency services immediately.
`;

export const ELDERLY_DISCLAIMER = `
ELDERLY CARE MONITORING DISCLAIMER

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

If you suspect a medical emergency, call emergency services immediately.
`;

export const PET_DISCLAIMER = `
PET MONITORING DISCLAIMER

SafeOS provides supplementary pet monitoring only.

• This is NOT a replacement for proper pet care
• AI may not detect all signs of pet distress or illness
• Monitoring may be interrupted by technical issues
• Some pet emergencies may not be visually apparent

Always ensure your pet has:
• Adequate food, water, and shelter
• Regular veterinary care
• Appropriate supervision for their needs

Contact a veterinarian for any health concerns.
`;

// =============================================================================
// Terms of Service
// =============================================================================

export const TERMS_OF_SERVICE = `
SAFEOS TERMS OF SERVICE

Last Updated: ${new Date().toISOString().split('T')[0]}

1. ACCEPTANCE OF TERMS
By using SafeOS, you agree to these terms and all disclaimers.

2. SERVICE DESCRIPTION
SafeOS is a free AI-powered monitoring service that provides supplementary 
observation capabilities for pets, babies/toddlers, and elderly individuals. 
It uses local AI models and cloud services to analyze video feeds.

3. LIMITATIONS OF LIABILITY
SafeOS is provided "AS IS" without warranties of any kind.
• We are NOT responsible for any incidents, injuries, or damages
• We do NOT guarantee continuous operation or accuracy
• AI analysis may contain errors, false positives, or missed detections
• Technical failures may interrupt service at any time

4. USER RESPONSIBILITIES
You agree to:
• Maintain appropriate in-person supervision at all times
• Use SafeOS only as a supplement to proper care
• Not rely solely on SafeOS for safety-critical monitoring
• Comply with all applicable laws regarding surveillance and recording
• Not use the service for any illegal purposes

5. PRIVACY AND DATA
• Video data is processed locally when possible
• Rolling buffer deletes footage after 5-10 minutes
• Anonymization is applied before any human review
• We may comply with law enforcement for illegal activity
• See Privacy Policy for complete details

6. CONTENT MODERATION
We use AI to detect abuse, gore, pornography, and illegal content.
Flagged content may be:
• Automatically blocked
• Reviewed by anonymized human moderators
• Reported to law enforcement in extreme cases
Users may be banned for policy violations.

7. ACCEPTABLE USE
You may NOT use SafeOS to:
• Record individuals without proper consent
• Replace required medical or professional monitoring
• Engage in surveillance that violates privacy laws
• Monitor public spaces without authorization
• Create, store, or distribute illegal content

8. TERMINATION
We may terminate access for policy violations or abuse.
You may stop using the service at any time.

9. CHANGES TO TERMS
We may update these terms. Continued use constitutes acceptance.

10. CONTACT
For questions about these terms, contact: safety@supercloud.dev
`;

// =============================================================================
// Privacy Policy
// =============================================================================

export const PRIVACY_POLICY = `
SAFEOS PRIVACY POLICY

1. DATA COLLECTION
• Video/audio from your camera (processed locally when possible)
• Motion and audio level data
• Device and connection information
• Usage analytics

2. DATA PROCESSING
• AI analysis runs locally via Ollama when possible
• Cloud fallback uses OpenRouter/OpenAI/Anthropic
• Frames sent to cloud are not stored permanently
• Rolling buffer automatically deletes after 5-10 minutes

3. DATA STORAGE
• Local SQLite database for alerts and settings
• No permanent video storage
• Anonymized metrics for service improvement

4. DATA SHARING
• We do NOT sell your data
• Cloud AI providers may process frames for analysis
• Law enforcement may receive data for serious crimes
• Human reviewers see only anonymized/blurred content

5. YOUR RIGHTS
• Delete your data at any time
• Export your settings and alert history
• Opt out of cloud processing (local-only mode)
• Request information about data we hold

6. SECURITY
• End-to-end encryption for data in transit
• Local storage encrypted at rest
• Access controls for human review
• Regular security audits

7. CONTACT
Privacy concerns: privacy@supercloud.dev
`;

// =============================================================================
// Scenario-Specific Disclaimers
// =============================================================================

export function getDisclaimers(scenario: 'pet' | 'baby' | 'elderly'): {
  critical: string;
  specific: string;
  acknowledgment: string;
} {
  const specific = {
    pet: PET_DISCLAIMER,
    baby: BABY_DISCLAIMER,
    elderly: ELDERLY_DISCLAIMER,
  }[scenario];

  const acknowledgment = {
    pet: 'I understand SafeOS supplements but does not replace proper pet care.',
    baby: 'I understand SafeOS does NOT replace parental supervision and I will maintain appropriate oversight at all times.',
    elderly: 'I understand SafeOS does NOT replace professional care and I will ensure appropriate human supervision.',
  }[scenario];

  return {
    critical: CRITICAL_DISCLAIMER,
    specific,
    acknowledgment,
  };
}

// =============================================================================
// Onboarding Requirements
// =============================================================================

export interface OnboardingStep {
  id: string;
  title: string;
  content: string;
  requiresAcknowledgment: boolean;
  acknowledgmentText?: string;
}

export function getOnboardingSteps(scenario: 'pet' | 'baby' | 'elderly'): OnboardingStep[] {
  const disclaimers = getDisclaimers(scenario);

  return [
    {
      id: 'critical-disclaimer',
      title: 'Important Safety Notice',
      content: disclaimers.critical,
      requiresAcknowledgment: true,
      acknowledgmentText: 'I understand SafeOS is a supplementary tool only',
    },
    {
      id: 'scenario-disclaimer',
      title: `${scenario.charAt(0).toUpperCase() + scenario.slice(1)} Monitoring Disclaimer`,
      content: disclaimers.specific,
      requiresAcknowledgment: true,
      acknowledgmentText: disclaimers.acknowledgment,
    },
    {
      id: 'terms-of-service',
      title: 'Terms of Service',
      content: TERMS_OF_SERVICE,
      requiresAcknowledgment: true,
      acknowledgmentText: 'I agree to the Terms of Service',
    },
    {
      id: 'privacy-policy',
      title: 'Privacy Policy',
      content: PRIVACY_POLICY,
      requiresAcknowledgment: true,
      acknowledgmentText: 'I accept the Privacy Policy',
    },
  ];
}


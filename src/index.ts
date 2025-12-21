/**
 * SafeOS - Free AI Monitoring Service
 *
 * Part of SuperCloud's humanitarian mission:
 * - 10% to humanity
 * - 10% to animals/nature
 *
 * @module safeos
 */

// Types
export * from './types/index.js';

// Database
export { createSafeOSDatabase, getSafeOSDatabase, closeSafeOSDatabase } from './db/index.js';

// Ollama Client
export { OllamaClient, createOllamaClient, getDefaultOllamaClient } from './lib/ollama/client.js';

// Analysis
export { FrameAnalyzer } from './lib/analysis/frame-analyzer.js';

// Alerts
export { AlertEscalationManager } from './lib/alerts/escalation.js';

// Safety
export { CRITICAL_DISCLAIMER, TERMS_OF_SERVICE, getDisclaimers } from './lib/safety/disclaimers.js';

// Version
export const VERSION = '0.1.0';
export const NAME = 'SafeOS';
export const DESCRIPTION = 'Free AI monitoring service for pets, babies, and elderly care';


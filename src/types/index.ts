/**
 * SafeOS Type Definitions
 *
 * Core types for the SafeOS monitoring service.
 *
 * @module types
 */

// =============================================================================
// Monitoring Scenarios
// =============================================================================

export type MonitoringScenario = 'pet' | 'baby' | 'elderly';

export interface MonitoringProfile {
  id: string;
  name: string;
  scenario: MonitoringScenario;
  motionThreshold: number; // 0-1, percentage of changed pixels to trigger
  audioThreshold: number; // 0-1, volume level to trigger
  alertSpeed: 'slow' | 'normal' | 'fast' | 'immediate';
  description: string;
  customPrompt?: string;
}

// =============================================================================
// Streams
// =============================================================================

export interface Stream {
  id: string;
  name: string;
  profileId: string;
  status: 'active' | 'paused' | 'disconnected';
  createdAt: string;
  lastFrameAt?: string;
  metadata?: Record<string, unknown>;
}

export interface StreamConfig {
  name: string;
  profileId: string;
  motionThreshold?: number;
  audioThreshold?: number;
}

// =============================================================================
// Frames & Analysis
// =============================================================================

export interface FrameBuffer {
  id: string;
  streamId: string;
  frameData: string; // Base64 JPEG
  capturedAt: string;
  motionScore: number;
  audioLevel: number;
  analyzed: boolean;
}

export type ConcernLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface AnalysisResult {
  id: string;
  streamId: string;
  frameId?: string;
  scenario: MonitoringScenario;
  concernLevel: ConcernLevel;
  description: string;
  modelUsed: string;
  inferenceMs: number;
  createdAt: string;
  rawResponse?: string;
}

export interface AnalysisJob {
  id: string;
  streamId: string;
  frameData: string;
  scenario: MonitoringScenario;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  createdAt: string;
}

// =============================================================================
// Alerts
// =============================================================================

export type AlertType = 'motion' | 'audio' | 'concern' | 'system';
export type AlertSeverity = 'info' | 'warning' | 'urgent' | 'critical';

export interface Alert {
  id: string;
  streamId: string;
  analysisId?: string;
  alertType: AlertType;
  severity: AlertSeverity;
  message: string;
  escalationLevel: number;
  acknowledged: boolean;
  createdAt: string;
  acknowledgedAt?: string;
}

export interface AlertEscalation {
  level: number;
  delaySeconds: number;
  volume: number; // 0-100
  sound: 'none' | 'chime' | 'alert' | 'alarm' | 'critical';
  notify: ('browser' | 'sms' | 'telegram')[];
}

// =============================================================================
// Ollama
// =============================================================================

export interface OllamaModelInfo {
  name: string;
  modifiedAt: string;
  size: number;
  digest: string;
  details?: {
    format: string;
    family: string;
    parameterSize: string;
    quantizationLevel: string;
  };
}

export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  images?: string[]; // Base64 encoded
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    num_predict?: number;
  };
}

export interface OllamaGenerateResponse {
  model: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
  eval_duration?: number;
}

// =============================================================================
// WebSocket Messages
// =============================================================================

export type WSMessageType =
  | 'frame'
  | 'audio_level'
  | 'motion_detected'
  | 'analysis_result'
  | 'alert'
  | 'stream_status'
  | 'error'
  | 'ping'
  | 'pong';

export interface WSMessage {
  type: WSMessageType;
  streamId?: string;
  payload: unknown;
  timestamp: string;
}

export interface WSFrameMessage extends WSMessage {
  type: 'frame';
  payload: {
    frameData: string;
    motionScore: number;
    audioLevel: number;
  };
}

export interface WSAlertMessage extends WSMessage {
  type: 'alert';
  payload: Alert;
}

// =============================================================================
// Notifications
// =============================================================================

export interface NotificationConfig {
  browser: {
    enabled: boolean;
    vapidPublicKey?: string;
  };
  twilio: {
    enabled: boolean;
    phoneNumbers: string[];
  };
  telegram: {
    enabled: boolean;
    chatIds: string[];
  };
}

export interface NotificationPayload {
  title: string;
  body: string;
  severity: AlertSeverity;
  streamId: string;
  alertId: string;
  url?: string;
}

// =============================================================================
// Safety & Moderation
// =============================================================================

export type ModerationTier = 1 | 2 | 3 | 4;

export interface ModerationResult {
  tier: ModerationTier;
  flagged: boolean;
  categories: string[];
  confidence: number;
  action: 'allow' | 'blur' | 'block' | 'escalate';
  reason?: string;
}

export interface ContentFlag {
  id: string;
  streamId: string;
  frameId: string;
  tier: ModerationTier;
  categories: string[];
  status: 'pending' | 'reviewed' | 'escalated' | 'dismissed';
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
  createdAt: string;
}

// =============================================================================
// Configuration
// =============================================================================

export interface SafeOSConfig {
  port: number;
  host: string;
  bufferMinutes: number;
  ollama: {
    host: string;
    triageModel: string;
    analysisModel: string;
    timeout: number;
  };
  notifications: NotificationConfig;
  moderation: {
    enabled: boolean;
    autoEscalate: boolean;
  };
}

// =============================================================================
// API Responses
// =============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}


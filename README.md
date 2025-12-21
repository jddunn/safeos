# SafeOS

**Free AI Monitoring Service for Pets, Babies & Elderly Care**

Part of SuperCloud's humanitarian mission: 10% to humanity, 10% to animals/nature.

## Overview

SafeOS is a privacy-first AI monitoring service that **supplements (never replaces)** human care. It runs locally on your computer for zero-cost operation, with cloud fallback when needed.

## Features

- **Local-First AI**: Uses Ollama for on-device vision analysis (Moondream, LLaVA)
- **Privacy-Focused**: Rolling 5-minute buffer, no permanent storage
- **Multi-Scenario**: Pet monitoring, baby/toddler watching, elderly care
- **Smart Detection**: Motion + audio analysis with configurable thresholds
- **Alert Escalation**: Volume ramping from gentle chime to full alarm
- **Multi-Channel Notifications**: Browser Push, Twilio SMS, Telegram

## Important Disclaimers

```
SAFEOS IS A SUPPLEMENTARY MONITORING TOOL ONLY.

This service:
- Does NOT replace in-person care, supervision, or medical attention
- Does NOT guarantee detection of all events or emergencies
- May experience delays, outages, or missed detections

You MUST maintain appropriate human supervision at all times.
```

## Quick Start

### 1. Install Ollama (Required)

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull required models
ollama pull moondream    # Fast triage (~830MB)
ollama pull llava:7b     # Detailed analysis (~4.5GB)

# Start Ollama server
ollama serve
```

### 2. Start SafeOS API

```bash
cd packages/safeos
npm install
npm run api
```

### 3. Start Guardian UI

```bash
cd packages/safeos/apps/guardian-ui
npm install
npm run dev
```

### 4. Open in Browser

Navigate to `http://localhost:3000` and follow the onboarding flow.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND (Guardian UI - Next.js)                               │
│  Camera Feed + Motion Detection + Audio Monitor + Alert Panel   │
└─────────────────────────┬───────────────────────────────────────┘
                          │ WebSocket + REST
┌─────────────────────────▼───────────────────────────────────────┐
│  BACKEND (Express + WebSocket)                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ REST API     │  │ Analysis     │  │ sql-storage-adapter    │ │
│  │ + WebSocket  │  │ Queue        │  │ (5-min rolling buffer) │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
│                              │                                   │
│  ┌───────────────────────────▼──────────────────────────────┐   │
│  │  WORKER POOL                                              │   │
│  │  Local (Ollama) → Cloud Fallback (OpenRouter/OpenAI)     │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Monitoring Profiles

| Profile | Motion Threshold | Audio Sensitivity | Alert Speed |
|---------|-----------------|-------------------|-------------|
| Pet     | 20%             | Low               | Normal      |
| Baby    | 10%             | High (crying)     | Fast        |
| Elderly | 15%             | Medium (distress) | Immediate   |

## Environment Variables

```bash
# Ollama (local)
OLLAMA_HOST=http://localhost:11434
OLLAMA_TRIAGE_MODEL=moondream
OLLAMA_ANALYSIS_MODEL=llava:7b

# Cloud fallback (optional)
OPENROUTER_API_KEY=sk-or-...
OPENAI_API_KEY=sk-...

# Notifications (optional)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM=+1234567890
TELEGRAM_BOT_TOKEN=...

# SafeOS
SAFEOS_PORT=8474
SAFEOS_BUFFER_MINUTES=5
```

## Cost Estimates

| Component | Cost |
|-----------|------|
| Local inference (Ollama) | $0 |
| Cloud fallback (5% of requests) | ~$10-20/month |
| Twilio SMS | $0.01/message |
| Telegram | Free |

**Total: ~$15-30/month** for moderate usage with mostly local inference.

## Legal & Safety

SafeOS includes:
- Mandatory onboarding disclaimers
- AI-based abuse detection
- Content moderation tiers
- Anonymized human review for flagged content
- IP logging for extreme cases (law enforcement compliance)

## License

MIT - Part of the SuperCloud project

## Contributing

SafeOS is part of SuperCloud's humanitarian initiative. Contributions welcome!


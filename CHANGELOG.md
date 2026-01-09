# Changelog

All notable changes to SafeOS Guardian will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-01-08

### Added
- Initial release of SafeOS Guardian
- **Local-First AI Monitoring**
  - TensorFlow.js COCO-SSD for person and animal detection
  - Transformers.js for enhanced vision analysis (browser-based)
  - Motion detection with configurable sensitivity
  - Audio pattern detection (crying, barking, glass breaking)
- **Privacy-Focused Design**
  - All processing happens locally in the browser
  - No server required for core functionality
  - IndexedDB for offline data storage
- **PWA Support**
  - Install as native app on any device
  - Full offline functionality via Service Worker
  - Web Push notifications for alerts
- **Deployment Options**
  - GitHub Pages static deployment (free)
  - Optional Linode backend for cloud sync
  - Docker Compose production configuration
- **Alert System**
  - Visual fingerprinting for subject recognition
  - Configurable alert thresholds
  - Escalating audio alerts
  - Local alert history with IndexedDB
- **Multi-Scenario Support**
  - Baby monitoring mode
  - Pet monitoring mode
  - Elderly care mode
  - Security monitoring mode

### Security
- Local-only data storage by default
- Optional encrypted cloud sync
- No third-party analytics or tracking

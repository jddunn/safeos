# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

Please report security vulnerabilities to: **security@frame.dev**

We will respond within 48 hours and provide updates as we investigate.

**Please include:**
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes (optional)

## Security Features

### Local-First Architecture
- All AI processing runs in your browser (TensorFlow.js, Transformers.js)
- No data leaves your device unless you configure a backend
- Camera feeds are never transmitted by default

### Data Storage
- IndexedDB for local storage (encrypted at rest by browser)
- Optional cloud sync uses HTTPS/WSS only
- No third-party analytics or tracking

### Authentication (Backend Mode)
- Passwords hashed with scrypt (N=16384, r=8, p=1)
- Session tokens generated with crypto.randomBytes (32 bytes)
- JWT tokens with configurable expiration
- Rate limiting on auth endpoints

### Network Security
- All backend connections require HTTPS/WSS
- CORS configured for specific origins only
- WebSocket connections authenticated

## Best Practices

1. **Keep dependencies updated** - Run `npm audit` regularly
2. **Use HTTPS** - Never deploy backend without TLS
3. **Restrict CORS** - Only allow your frontend origin
4. **Monitor logs** - Check for unusual access patterns
5. **Backup data** - Export IndexedDB data periodically

## Known Limitations

- Browser storage is limited (~50MB IndexedDB per origin)
- Service Worker requires HTTPS (except localhost)
- WebRTC camera access requires user permission each session

## Acknowledgments

We appreciate responsible disclosure and will acknowledge security researchers who report valid vulnerabilities.

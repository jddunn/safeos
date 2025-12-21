/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow WebSocket connections to SafeOS API
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8474/api/:path*',
      },
    ];
  },
  // Headers for camera access
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'camera=self, microphone=self',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;


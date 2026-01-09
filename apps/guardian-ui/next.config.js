/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'export', // Enable static exports for GitHub Pages
  trailingSlash: true,
  images: {
    unoptimized: true, // Required for static export
  },
  // Environment variables for client-side
  // Empty strings for API/WS indicate local-only mode (no backend)
  // Set NEXT_PUBLIC_STATIC_MODE=true for GitHub Pages deployment
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || '',
    NEXT_PUBLIC_STATIC_MODE: process.env.NEXT_PUBLIC_STATIC_MODE || 'false',
  },
  // Webpack configuration for Transformers.js compatibility
  webpack: (config, { isServer }) => {
    // Handle ONNX runtime web workers
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };

    // Ensure .wasm files are handled correctly
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    });

    return config;
  },
};

module.exports = nextConfig;

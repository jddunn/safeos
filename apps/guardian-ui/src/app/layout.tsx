/**
 * Root Layout
 *
 * Root layout for the SafeOS Guardian UI.
 * Industrial, utilitarian design system.
 *
 * @module app/layout
 */

import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';

// =============================================================================
// Fonts - Industrial Typography System
// =============================================================================

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-space-grotesk',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
});

// =============================================================================
// Metadata
// =============================================================================

export const metadata: Metadata = {
  title: 'SafeOS Guardian - Humanitarian AI Monitoring',
  description:
    'Free AI-powered monitoring service for pets, babies, and elderly care. Part of SuperCloud\'s 10% for Humanity initiative.',
  keywords: [
    'baby monitor',
    'pet monitor',
    'elderly care',
    'AI monitoring',
    'free monitoring',
    'humanitarian',
    'local AI',
    'privacy-first',
  ],
  authors: [{ name: 'SuperCloud' }],
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
  openGraph: {
    title: 'SafeOS Guardian',
    description: 'Free AI-powered humanitarian monitoring',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0c0f',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

// =============================================================================
// Layout
// =============================================================================

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Preconnect to font origins for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        {children}

        {/* Service Worker Registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function(e) {
                    console.log('ServiceWorker registration failed: ', e);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}

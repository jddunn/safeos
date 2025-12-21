import type { Metadata } from 'next';
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'SafeOS Guardian - Free AI Monitoring',
  description:
    'Free AI-powered monitoring for pets, babies, and elderly care. Part of SuperCloud humanitarian mission.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
            <div className="container mx-auto px-4 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-safeos-400 to-safeos-600 flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">SafeOS Guardian</h1>
                  <p className="text-xs text-white/60">Free AI Monitoring</p>
                </div>
              </div>
              <nav className="flex items-center gap-4">
                <a
                  href="/"
                  className="text-sm text-white/80 hover:text-white transition"
                >
                  Dashboard
                </a>
                <a
                  href="/monitor"
                  className="text-sm text-white/80 hover:text-white transition"
                >
                  Monitor
                </a>
                <a
                  href="/setup"
                  className="text-sm text-white/80 hover:text-white transition"
                >
                  Setup
                </a>
              </nav>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-white/10 bg-black/20 py-6">
            <div className="container mx-auto px-4 text-center">
              <p className="text-xs text-white/40">
                SafeOS is a supplementary monitoring tool only. It does NOT replace
                in-person care or supervision.
              </p>
              <p className="text-xs text-white/30 mt-2">
                Part of SuperCloud&apos;s humanitarian mission: 10% to humanity, 10% to
                animals/nature.
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}


import type { Metadata, Viewport } from 'next';
import { DM_Sans, Fraunces } from 'next/font/google';
import Script from 'next/script';
import '@/styles/globals.css';

/*
 * Self-hosted fonts via next/font. They are fetched at build time and served
 * from our own origin, so there is no render-blocking request to Google Fonts
 * and no layout shift (next/font generates a metrics-matched fallback).
 *
 * Both are loaded as VARIABLE fonts (no fixed weight):
 *   - Fraunces additionally requests the optical-size axis, because the display
 *     type uses `font-variation-settings: "opsz" 144`. Italic is included for
 *     the hero accent (`.heroTitleAccent`).
 *   - DM Sans's variable weight range (100–1000) covers every weight the UI
 *     uses (400/500/600/700).
 *
 * The CSS variables below are consumed by tokens.css
 * (`--nh-font-display` / `--nh-font-body`).
 */
const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  style: ['normal', 'italic'],
  axes: ['opsz'],
  variable: '--font-fraunces',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-dm-sans',
});

export const metadata: Metadata = {
  title: "NoHunger — Turn extra food into someone's next meal",
  description:
    'NoHunger is a real-time sharing platform that pairs neighbors with extra food with people who could use a meal — before anything goes to waste.',
  manifest: '/manifest.webmanifest',
  applicationName: 'NoHunger',
  appleWebApp: { capable: true, title: 'NoHunger', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon.svg', apple: '/icons/icon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#F5F0E6',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${dmSans.variable}`}>
      <body>
        {children}
        {/*
          Register the service worker after hydration. Deliberately not blocking
          because the app must render without JS, and push is a progressive
          enhancement — no permission prompt happens here, just the SW install.
        */}
        <Script id="sw-register" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function () {
                navigator.serviceWorker.register('/sw.js').catch(function () {
                  // ignore: push simply won't work
                });
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}

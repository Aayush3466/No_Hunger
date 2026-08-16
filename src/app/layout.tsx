import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import '@/styles/globals.css';

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
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;0,9..144,800;1,9..144,400&family=DM+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
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
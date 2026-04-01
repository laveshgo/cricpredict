import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Providers from '@/components/layout/Providers';
import AppHeader from '@/components/layout/AppHeader';
import BottomTabs from '@/components/layout/BottomTabs';
import ProfileGate from '@/components/layout/ProfileGate';
import ServiceWorkerRegister from '@/components/layout/ServiceWorkerRegister';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'CricPredict - Fantasy Cricket',
  description:
    'Create and join fantasy cricket contests with friends. Predict team rankings, top players, match winners, and compete on leaderboards.',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'CricPredict',
  },
};

export const viewport: Viewport = {
  themeColor: '#0f1117',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Preconnect to Firestore — starts TLS handshake early while JS loads */}
        <link rel="preconnect" href="https://firestore.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://www.googleapis.com" crossOrigin="anonymous" />
        {/* iOS PWA splash / status bar */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="CricPredict" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--bg-primary)]">
        <Providers>
          <ServiceWorkerRegister />
          <AppHeader />
          <main className="flex-1 pb-20">
            <ProfileGate>{children}</ProfileGate>
          </main>
          <BottomTabs />
        </Providers>
      </body>
    </html>
  );
}

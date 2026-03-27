import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Providers from '@/components/layout/Providers';
import Navbar from '@/components/layout/Navbar';
import ProfileGate from '@/components/layout/ProfileGate';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'CricPredict - Cricket Prediction Contest',
  description:
    'Create and join cricket prediction contests with friends. Predict team rankings, top players, match winners, and compete on leaderboards.',
  manifest: '/manifest.json',
  icons: { icon: '/favicon.ico' },
};

export const viewport: Viewport = {
  themeColor: '#0f1117',
  width: 'device-width',
  initialScale: 1,
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
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>
          <Navbar />
          <main className="flex-1">
            <ProfileGate>{children}</ProfileGate>
          </main>
        </Providers>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from 'next';
import { Roboto } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import ThemeProvider from '@/components/ThemeProvider';

const roboto = Roboto({ 
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TripMatrix - Trip Logging & Social Travel Tracking',
  description: 'Create trips, track navigation, log places, split expenses, and share your travel experiences',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TripMatrix',
  },
  manifest: '/manifest.json',
  other: {
    'mobile-web-app-capable': 'yes',
  }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#6750A4',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={roboto.className}>
        <div id="app-root" style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          width: '100%', 
          height: '100dvh',
          overflow: 'hidden',
          overscrollBehavior: 'none'
        }}>
          <ThemeProvider>
            <AuthProvider>{children}</AuthProvider>
          </ThemeProvider>
        </div>
      </body>
    </html>
  );
}


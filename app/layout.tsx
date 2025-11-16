import './globals.css';
import { AuthProvider } from '@/lib/auth';
import Script from 'next/script';

export const metadata = {
  title: 'Swift Will F*** You',
  description: 'Track trips, loads, stops, and calculate pay for Swift truck drivers',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" style={{ height: '100%' }}>
      <body style={{ height: '100%', margin: 0, padding: 0 }}>
        <Script 
          src="/firebase-config.js" 
          strategy="beforeInteractive"
          onLoad={() => {
            // Trigger Firebase initialization after script loads
            if (typeof window !== 'undefined' && window.__FIREBASE_CONFIG__) {
              // Small delay to ensure config is set
              setTimeout(() => {
                const event = new Event('firebase-config-loaded');
                window.dispatchEvent(event);
              }, 50);
            }
          }}
          onError={() => {
            console.warn('firebase-config.js not found. Using environment variables if available.');
          }}
        />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}


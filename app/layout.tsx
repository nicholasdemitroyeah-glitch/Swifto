import './globals.css';
import { AuthProvider } from '@/lib/auth';
import FirebaseConfigLoader from '@/components/FirebaseConfigLoader';

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
        <FirebaseConfigLoader />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}


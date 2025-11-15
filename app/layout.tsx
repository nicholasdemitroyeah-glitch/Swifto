import './globals.css';
import { AuthProvider } from '@/lib/auth';

export const metadata = {
  title: 'Swifto: Trip & Pay Calculator',
  description: 'Track trips, loads, stops, and calculate pay for Swift truck drivers',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}


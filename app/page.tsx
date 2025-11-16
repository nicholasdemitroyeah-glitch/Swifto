'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import BootAnimation from '@/components/BootAnimation';
import LoginPage from '@/components/LoginPage';

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [showBoot, setShowBoot] = useState(true);
  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    if (!showBoot && !authLoading && user && !hasRedirected) {
      router.push('/dashboard');
      setHasRedirected(true);
    }
  }, [showBoot, authLoading, user, router, hasRedirected]);

  const handleBootComplete = () => {
    setShowBoot(false);
  };

  if (showBoot) {
    return <BootAnimation onComplete={handleBootComplete} />;
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center ntransit-shell">
        <div className="text-white/70 text-sm tracking-[0.3em] uppercase">Checking auth</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center ntransit-shell text-white">
      <div className="text-center space-y-2">
        <p className="text-xs uppercase tracking-[0.4em] text-white/50">Authenticated</p>
        <p className="text-lg font-semibold">Routing to dashboard…</p>
      </div>
    </div>
  );
}


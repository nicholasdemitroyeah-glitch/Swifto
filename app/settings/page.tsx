'use client';

import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import SettingsPage from '@/components/SettingsPage';
import { useEffect } from 'react';

export default function Settings() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <SettingsPage />;
}


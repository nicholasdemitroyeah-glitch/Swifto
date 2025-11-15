'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import TripPage from '@/components/TripPage';
import { useEffect } from 'react';

export default function TripDetailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const tripId = searchParams.get('id');

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

  if (!tripId) {
    router.push('/dashboard');
    return null;
  }

  const handleFinishTrip = () => {
    router.push('/dashboard');
  };

  return <TripPage tripId={tripId} onFinishTrip={handleFinishTrip} />;
}


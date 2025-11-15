'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import TripPage from '@/components/TripPage';
import { useEffect, Suspense } from 'react';

function TripContent() {
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

export default function TripDetailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    }>
      <TripContent />
    </Suspense>
  );
}


'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import TripPage from '@/components/TripPage';

// Required for static export with dynamic routes
export function generateStaticParams() {
  return [];
}

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const tripId = params.id as string;

  const handleFinishTrip = () => {
    router.push('/dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    router.push('/');
    return null;
  }

  return <TripPage tripId={tripId} onFinishTrip={handleFinishTrip} />;
}


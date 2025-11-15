'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import BootAnimation from '@/components/BootAnimation';
import LoginPage from '@/components/LoginPage';
import Dashboard from '@/components/Dashboard';
import SettingsPage from '@/components/SettingsPage';
import TripPage from '@/components/TripPage';
import { createTrip } from '@/lib/db';
import { motion, AnimatePresence } from 'framer-motion';

type Page = 'boot' | 'login' | 'dashboard' | 'settings' | 'start-trip' | 'trip' | 'edit-trip';

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [page, setPage] = useState<Page>('boot');
  const [showBoot, setShowBoot] = useState(true);
  const [currentTripId, setCurrentTripId] = useState<string | null>(null);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [startMileage, setStartMileage] = useState('');

  useEffect(() => {
    if (!authLoading) {
      if (showBoot) {
        return;
      }
      if (!user) {
        setPage('login');
      } else {
        // Redirect to dashboard route
        router.push('/dashboard');
      }
    }
  }, [user, authLoading, showBoot, router]);

  const handleBootComplete = () => {
    setShowBoot(false);
  };

  const handleStartNewTrip = () => {
    setPage('start-trip');
  };

  const handleStartTrip = async () => {
    if (!user || !startMileage) return;
    const mileage = parseFloat(startMileage);
    if (isNaN(mileage) || mileage < 0) {
      alert('Please enter a valid mileage');
      return;
    }

    try {
      const tripId = await createTrip(user.uid, mileage);
      setCurrentTripId(tripId);
      setPage('trip');
      setStartMileage('');
    } catch (error) {
      console.error('Error creating trip:', error);
      alert('Failed to create trip. Please try again.');
    }
  };

  const handleEditTrip = (tripId: string) => {
    setEditingTripId(tripId);
    setCurrentTripId(tripId);
    setPage('trip');
  };

  const handleFinishTrip = () => {
    setCurrentTripId(null);
    setPage('dashboard');
  };

  if (showBoot) {
    return <BootAnimation onComplete={handleBootComplete} />;
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {page === 'login' && (
        <motion.div
          key="login"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <LoginPage />
        </motion.div>
      )}

      {page === 'settings' && (
        <motion.div
          key="settings"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <SettingsPage />
        </motion.div>
      )}

      {page === 'dashboard' && user && (
        <motion.div
          key="dashboard"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <Dashboard
            onStartNewTrip={handleStartNewTrip}
            onEditTrip={handleEditTrip}
          />
        </motion.div>
      )}

      {page === 'start-trip' && (
        <motion.div
          key="start-trip"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="min-h-screen p-4 flex items-center justify-center"
        >
          <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Start New Trip</h2>
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Current Odometer
              </label>
              <input
                type="number"
                value={startMileage}
                onChange={(e) => setStartMileage(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none text-lg"
                placeholder="Enter current mileage"
                min="0"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage('dashboard')}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStartTrip}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-lg transition-colors"
              >
                Start Trip
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {page === 'trip' && currentTripId && (
        <motion.div
          key="trip"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <TripPage tripId={currentTripId} onFinishTrip={handleFinishTrip} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}


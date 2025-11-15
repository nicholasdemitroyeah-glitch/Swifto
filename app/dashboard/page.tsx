'use client';

import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Dashboard from '@/components/Dashboard';
import { useEffect, useState } from 'react';
import { createTrip } from '@/lib/db';
import { motion } from 'framer-motion';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [startMileage, setStartMileage] = useState('');
  const [showStartTrip, setShowStartTrip] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  const handleStartNewTrip = () => {
    setShowStartTrip(true);
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
      router.push(`/trip?id=${tripId}`);
      setStartMileage('');
      setShowStartTrip(false);
    } catch (error: any) {
      console.error('Error creating trip:', error);
      const errorMessage = error?.message || 'Unknown error';
      alert(`Failed to create trip: ${errorMessage}. Please check your Firestore security rules.`);
    }
  };

  const handleEditTrip = (tripId: string) => {
    router.push(`/trip?id=${tripId}`);
  };

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

  return (
    <>
      {showStartTrip && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setShowStartTrip(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-strong rounded-3xl p-8 max-w-md w-full border border-white/20 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full blur-3xl" />
            <div className="relative z-10">
              <h2 className="text-3xl font-bold text-white mb-6">Start New Trip</h2>
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-300 mb-3">
                  Current Odometer
                </label>
                <input
                  type="number"
                  value={startMileage}
                  onChange={(e) => setStartMileage(e.target.value)}
                  className="w-full px-4 py-4 bg-dark-700/50 border-2 border-dark-600 rounded-xl focus:border-blue-500 focus:outline-none text-lg text-white"
                  placeholder="Enter current mileage"
                  min="0"
                />
              </div>
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowStartTrip(false)}
                  className="flex-1 glass hover:border-white/30 border border-white/10 text-gray-300 font-semibold py-3 rounded-xl transition-all"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleStartTrip}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3 rounded-xl transition-all shadow-lg"
                >
                  Start Trip
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
      <Dashboard
        onStartNewTrip={handleStartNewTrip}
        onEditTrip={handleEditTrip}
      />
    </>
  );
}


'use client';

import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Dashboard from '@/components/Dashboard';
import { useEffect, useState } from 'react';
import { createTrip } from '@/lib/db';
import { motion, AnimatePresence } from 'framer-motion';
import { hapticLight, hapticMedium } from '@/lib/haptics';

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
      <div className="h-full flex items-center justify-center bg-black">
        <div className="text-white text-base">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <Dashboard
        onStartNewTrip={handleStartNewTrip}
        onEditTrip={handleEditTrip}
      />
      
      {/* Start Trip Modal - Bottom Sheet */}
      <AnimatePresence>
        {showStartTrip && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-[#01060f]/85 backdrop-blur-2xl z-50 safe-bottom"
            onClick={() => { hapticLight(); setShowStartTrip(false); }}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-0 left-0 right-0 glass rounded-t-3xl p-6"
            >
              <div className="w-12 h-1 bg-white/30 rounded-full mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-white mb-5" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif', fontWeight: 700 }}>
                Start New Trip
              </h2>
              <div className="mb-5">
                <label className="block text-sm font-medium text-white/90 mb-3" style={{ fontSize: '15px', fontWeight: 500 }}>
                  Current Odometer
                </label>
                <input
                  type="number"
                  value={startMileage}
                  onChange={(e) => setStartMileage(e.target.value)}
                  className="w-full px-4 py-4 glass rounded-xl border border-white/10 focus:border-blue-500 focus:outline-none text-white"
                  placeholder="Enter current mileage"
                  min="0"
                  style={{ fontSize: '17px' }}
                />
              </div>
              <div className="flex gap-3">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { hapticLight(); setShowStartTrip(false); }}
                  className="flex-1 glass rounded-xl text-white/90 font-medium py-3.5 active:opacity-70"
                  style={{ fontSize: '17px', fontWeight: 500 }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { hapticMedium(); handleStartTrip(); }}
                  className="flex-1 glass rounded-xl text-white font-medium py-3.5 active:opacity-70"
                  style={{ fontSize: '17px', fontWeight: 600 }}
                >
                  Start Trip
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

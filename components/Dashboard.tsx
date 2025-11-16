'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { getTrips, getSettings, deleteTrip, Trip, Settings } from '@/lib/db';
import { getWeeklyEarnings, formatCurrency, formatDate, isInCurrentWeek } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { LineChart, Line, Tooltip, ResponsiveContainer } from 'recharts';
import { hapticLight, hapticMedium, hapticHeavy, hapticSuccess, hapticError } from '@/lib/haptics';

interface DashboardProps {
  onStartNewTrip: () => void;
  onEditTrip: (tripId: string) => void;
}

export default function Dashboard({ onStartNewTrip, onEditTrip }: DashboardProps) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingTripId, setDeletingTripId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    try {
      const [tripsData, settingsData] = await Promise.all([
        getTrips(user.uid),
        getSettings(user.uid),
      ]);
      setTrips(tripsData);
      setSettings(settingsData);
      
      if (!settingsData) {
        router.push('/settings');
        return;
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTrip = async (tripId: string) => {
    if (!confirm('Delete this trip? This cannot be undone.')) return;
    
    hapticHeavy();
    setDeletingTripId(tripId);
    try {
      await deleteTrip(tripId);
      setTrips(trips.filter(trip => trip.id !== tripId));
      hapticSuccess();
    } catch (error) {
      console.error('Error deleting trip:', error);
      alert('Failed to delete trip. Please try again.');
      hapticError();
    } finally {
      setDeletingTripId(null);
    }
  };

  const weeklyEarnings = getWeeklyEarnings(trips);
  const sortedTrips = [...trips].sort((a, b) => {
    const dateA = a.createdAt?.toDate() || new Date(0);
    const dateB = b.createdAt?.toDate() || new Date(0);
    return dateB.getTime() - dateA.getTime();
  });

  const chartData = sortedTrips
    .filter(trip => {
      const tripDate = trip.createdAt?.toDate() || new Date();
      return isInCurrentWeek(tripDate);
    })
    .map((trip, index) => ({
      name: `Trip ${index + 1}`,
      earnings: trip.totalPay,
      date: formatDate(trip.createdAt?.toDate() || new Date()),
    }));

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center ntransit-shell">
        <div className="text-white/60 text-sm tracking-[0.35em] uppercase">Syncing</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col ntransit-shell text-white">
      <div className="flex-shrink-0 safe-top">
        <div className="px-5 pt-4 pb-4 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.45em] text-white/50 mb-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                N·Transit
              </p>
              <h1 className="text-2xl font-semibold leading-tight">Ops Dashboard</h1>
              <p className="text-white/50 text-sm">Live fleet telemetry &amp; pay modeling</p>
            </div>
            <div className="flex gap-2">
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => { hapticLight(); router.push('/settings'); }}
                className="w-11 h-11 glass rounded-2xl flex items-center justify-center text-white/80 border border-white/10"
              >
                ⚙️
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => { hapticMedium(); signOut(); }}
                className="px-4 h-11 glass rounded-2xl text-sm font-semibold tracking-wide"
              >
                Sign Out
              </motion.button>
            </div>
          </div>

          <div className="glass rounded-3xl p-5 space-y-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.4em] text-white/50">This Week</p>
                <p className="text-4xl font-semibold mt-2">{formatCurrency(weeklyEarnings)}</p>
              </div>
              <div className="text-right">
                <p className="text-white/60 text-xs">Trips logged</p>
                <p className="text-xl font-semibold">{sortedTrips.length}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs text-white/70">
              <div>
                <p className="uppercase tracking-[0.3em] text-white/40 mb-1">Active</p>
                <p className="text-lg font-semibold">{sortedTrips.filter(t => !t.isFinished).length}</p>
              </div>
              <div>
                <p className="uppercase tracking-[0.3em] text-white/40 mb-1">Loads</p>
                <p className="text-lg font-semibold">{sortedTrips.reduce((sum, trip) => sum + trip.loads.length, 0)}</p>
              </div>
              <div>
                <p className="uppercase tracking-[0.3em] text-white/40 mb-1">Night MI</p>
                <p className="text-lg font-semibold">
                  {sortedTrips.reduce((sum, trip) => sum + (trip.nightMiles || 0), 0).toFixed(1)}
                </p>
              </div>
            </div>
              {chartData.length > 0 && (
                <div className="h-24 bg-white/5 rounded-2xl px-3 py-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <Line type="monotone" dataKey="earnings" stroke="#48e0ff" strokeWidth={2} dot={false} />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ backgroundColor: 'rgba(2, 10, 24, 0.9)', border: 'none', borderRadius: 12, color: '#fff' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => { hapticMedium(); onStartNewTrip(); }}
              className="w-full ntransit-cta py-3.5 flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5 text-black/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Start New Trip</span>
            </motion.button>
          </div>
        </div>
      </div>

      <div className="flex-1 scroll-area safe-left safe-right safe-bottom">
        <div className="px-5 pb-6">
          {sortedTrips.length === 0 ? (
            <div className="glass rounded-3xl p-12 text-center text-white/60 text-sm">
              No trips yet. Launch a trip to begin capturing stop telemetry.
            </div>
          ) : (
            <div className="space-y-3">
              {sortedTrips.map((trip) => (
                <motion.div
                  key={trip.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass rounded-3xl p-4 relative overflow-hidden border border-white/5"
                  onClick={() => { hapticLight(); router.push(`/trip?id=${trip.id}`); }}
                >
                  <div className="absolute inset-0 opacity-30 bg-gradient-to-r from-white/10 via-transparent to-transparent pointer-events-none" />
                  <div className="relative flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-white/50">{formatDate(trip.createdAt?.toDate() || new Date())}</p>
                      <p className="text-2xl font-semibold mt-1">{formatCurrency(trip.totalPay)}</p>
                    </div>
                    <span className={`ntransit-chip ${trip.isFinished ? '!bg-green-400/10 !border-green-300/30 !text-green-200' : '!bg-cyan-400/10 !border-cyan-300/40 !text-cyan-200'}`}>
                      {trip.isFinished ? 'Archived' : 'Active'}
                    </span>
                  </div>
                  <div className="relative mt-3 grid grid-cols-3 text-xs text-white/60">
                    <div>
                      <p className="uppercase tracking-[0.2em] text-white/40">Trip MI</p>
                      <p className="text-sm font-semibold">{(trip.currentMileage - trip.startMileage).toFixed(1)}</p>
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.2em] text-white/40">Loads</p>
                      <p className="text-sm font-semibold">{trip.loads.length}</p>
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.2em] text-white/40">Night</p>
                      <p className="text-sm font-semibold">{(trip.nightMiles || 0).toFixed(1)}</p>
                    </div>
                  </div>
                  <div className="relative flex gap-2 mt-3">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => { e.stopPropagation(); hapticLight(); onEditTrip(trip.id); }}
                      className="flex-1 bg-white/10 rounded-2xl py-2 text-sm font-medium"
                    >
                      Resume
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => { e.stopPropagation(); handleDeleteTrip(trip.id); }}
                      disabled={deletingTripId === trip.id}
                      className="px-4 py-2 rounded-2xl border border-white/10 text-sm text-white/70 hover:text-white disabled:opacity-40"
                    >
                      {deletingTripId === trip.id ? '...' : 'Delete'}
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

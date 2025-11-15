'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { getTrips, getSettings, deleteTrip, Trip, Settings } from '@/lib/db';
import { getWeeklyEarnings, formatCurrency, formatDate, formatDateTime, isInCurrentWeek } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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
      <div className="h-full flex items-center justify-center bg-black">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Top Bar - Fixed */}
      <div className="flex-shrink-0 safe-top">
        <div className="px-4 pt-2 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-2xl font-bold text-white" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif', fontWeight: 700 }}>
                Dashboard
              </h1>
            </div>
            <div className="flex gap-2">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => { hapticLight(); router.push('/settings'); }}
                className="w-10 h-10 glass rounded-xl flex items-center justify-center text-white/90"
              >
                ⚙️
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => { hapticMedium(); signOut(); }}
                className="px-3 h-10 glass rounded-xl text-white/90 text-sm font-medium"
              >
                Out
              </motion.button>
            </div>
          </div>

          {/* Earnings Card - Compact */}
          <div className="glass rounded-2xl p-4 mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/60 text-xs">This Week</span>
              <span className="text-white/40 text-xs">{formatCurrency(weeklyEarnings)}</span>
            </div>
            <div className="text-3xl font-bold text-white mb-2" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif', fontWeight: 700 }}>
              {formatCurrency(weeklyEarnings)}
            </div>
            {chartData.length > 0 && (
              <div className="h-24 -mx-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <Line type="monotone" dataKey="earnings" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ backgroundColor: 'rgba(18, 18, 18, 0.95)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Start Trip Button */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => { hapticMedium(); onStartNewTrip(); }}
            className="w-full glass rounded-2xl px-4 py-3.5 text-white font-semibold mb-3 flex items-center justify-center gap-2"
            style={{ fontSize: '16px', fontWeight: 600 }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Trip
          </motion.button>
        </div>
      </div>

      {/* Scrollable Trips List */}
      <div className="flex-1 scroll-area safe-left safe-right safe-bottom">
        <div className="px-4 pb-4">
          {sortedTrips.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <p className="text-white/60 text-sm">No trips yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedTrips.map((trip) => (
                <motion.div
                  key={trip.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass rounded-2xl p-3.5 active:opacity-80"
                  onClick={() => { hapticLight(); router.push(`/trip?id=${trip.id}`); }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-semibold text-white truncate">
                          {formatDate(trip.createdAt?.toDate() || new Date())}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${trip.isFinished ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                          {trip.isFinished ? 'Done' : 'Active'}
                        </span>
                      </div>
                      <p className="text-white/50 text-xs">
                        {trip.currentMileage - trip.startMileage} mi • {trip.loads.length} loads
                      </p>
                    </div>
                    <div className="text-xl font-bold text-white ml-3" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif', fontWeight: 700 }}>
                      {formatCurrency(trip.totalPay)}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => { e.stopPropagation(); hapticLight(); onEditTrip(trip.id); }}
                      className="flex-1 glass rounded-xl px-3 py-2 text-white text-sm font-medium"
                    >
                      Edit
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => { e.stopPropagation(); handleDeleteTrip(trip.id); }}
                      disabled={deletingTripId === trip.id}
                      className="px-3 py-2 glass rounded-xl text-red-400 text-sm font-medium disabled:opacity-50"
                    >
                      {deletingTripId === trip.id ? '...' : '🗑️'}
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

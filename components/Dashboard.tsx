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
        <div className="text-white text-base">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Fixed Header */}
      <div className="flex-shrink-0 safe-top safe-left safe-right">
        <div className="px-4 pt-3 pb-2">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif', fontWeight: 700, letterSpacing: '-0.02em' }}>
                Dashboard
              </h1>
              <p className="text-white/50 text-xs mt-0.5">This week's earnings</p>
            </div>
            <div className="flex gap-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => { hapticLight(); router.push('/settings'); }}
                className="glass rounded-xl px-3 py-2 text-white/90 active:opacity-70"
                style={{ fontSize: '14px', fontWeight: 500 }}
              >
                ⚙️
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => { hapticMedium(); signOut(); }}
                className="glass rounded-xl px-3 py-2 text-white/90 active:opacity-70"
                style={{ fontSize: '14px', fontWeight: 500 }}
              >
                Sign Out
              </motion.button>
            </div>
          </div>

          {/* Weekly Earnings Card - Compact */}
          <div className="glass rounded-2xl p-4 mb-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-white/60 text-xs font-medium">Weekly Earnings</p>
            </div>
            <h2 className="text-3xl font-bold text-white tracking-tight mb-3" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif', fontWeight: 700, letterSpacing: '-0.03em' }}>
              {formatCurrency(weeklyEarnings)}
            </h2>
            
            {chartData.length > 0 && (
              <div className="h-32 -mx-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <defs>
                      <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" opacity={0.3} />
                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={9} />
                    <YAxis stroke="rgba(255,255,255,0.4)" fontSize={9} />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ 
                        backgroundColor: 'rgba(18, 18, 18, 0.95)', 
                        border: '0.5px solid rgba(255, 255, 255, 0.1)', 
                        borderRadius: '12px',
                        backdropFilter: 'blur(20px)',
                        color: '#fff',
                        fontSize: '11px'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="earnings" 
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: '#3b82f6', r: 3 }}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Start New Trip Button */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => { hapticMedium(); onStartNewTrip(); }}
            className="w-full glass rounded-2xl px-4 py-3.5 text-white font-semibold mb-3 active:opacity-80 flex items-center justify-center gap-2"
            style={{ fontSize: '16px', fontWeight: 600, fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Start New Trip
          </motion.button>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 scroll-area safe-left safe-right safe-bottom">
        <div className="px-4 pb-4">
          <h2 className="text-lg font-bold text-white mb-3 tracking-tight" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif', fontWeight: 700 }}>
            Your Trips
          </h2>
          
          {sortedTrips.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white/5 flex items-center justify-center">
                <svg className="w-7 h-7 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-white/60 text-sm">No trips yet. Start your first trip!</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              <AnimatePresence>
                {sortedTrips.map((trip, index) => (
                  <motion.div
                    key={trip.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.02 }}
                    className="glass rounded-2xl p-3.5 active:opacity-80"
                  >
                    <div className="flex justify-between items-start mb-2.5">
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <h3 className="text-base font-semibold text-white truncate" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif', fontWeight: 600 }}>
                            {formatDate(trip.createdAt?.toDate() || new Date())}
                          </h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            trip.isFinished 
                              ? 'bg-green-500/20 text-green-400' 
                              : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {trip.isFinished ? 'Done' : 'Active'}
                          </span>
                        </div>
                        <p className="text-white/60 text-xs mb-1">
                          {trip.currentMileage - trip.startMileage} mi • {trip.loads.length} {trip.loads.length === 1 ? 'load' : 'loads'}
                        </p>
                        {trip.createdAt && (
                          <p className="text-white/40 text-xs">
                            {formatDateTime(trip.createdAt.toDate())}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xl font-bold text-white" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif', fontWeight: 700, letterSpacing: '-0.02em' }}>
                          {formatCurrency(trip.totalPay)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mt-2.5">
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={() => { hapticLight(); router.push(`/trip?id=${trip.id}`); }}
                        className="flex-1 glass rounded-xl px-3 py-2 text-white text-sm font-medium active:opacity-70"
                        style={{ fontSize: '14px', fontWeight: 500 }}
                      >
                        View
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={() => { hapticLight(); onEditTrip(trip.id); }}
                        className="flex-1 glass rounded-xl px-3 py-2 text-white text-sm font-medium active:opacity-70"
                        style={{ fontSize: '14px', fontWeight: 500 }}
                      >
                        Edit
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={() => handleDeleteTrip(trip.id)}
                        disabled={deletingTripId === trip.id}
                        className="px-3 py-2 glass rounded-xl text-red-400 text-sm font-medium active:opacity-70 disabled:opacity-50"
                        style={{ fontSize: '14px', fontWeight: 500 }}
                      >
                        {deletingTripId === trip.id ? (
                          <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          '🗑️'
                        )}
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

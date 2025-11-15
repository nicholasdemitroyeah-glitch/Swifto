'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { getTrip, updateTrip, getSettings, Trip, Settings, Load, Stop } from '@/lib/db';
import { calculateTripPay, formatCurrency, formatDateTime } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Timestamp } from 'firebase/firestore';

interface TripPageProps {
  tripId: string;
  onFinishTrip: () => void;
}

export default function TripPage({ tripId, onFinishTrip }: TripPageProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddLoad, setShowAddLoad] = useState(false);
  const [showUpdateMileage, setShowUpdateMileage] = useState(false);
  const [showFinishTrip, setShowFinishTrip] = useState(false);
  const [showEditLoad, setShowEditLoad] = useState<string | null>(null);
  const [newMileage, setNewMileage] = useState('');
  const [newStops, setNewStops] = useState('');
  const [editStops, setEditStops] = useState('');
  const [loadType, setLoadType] = useState<'wet' | 'dry'>('dry');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (user) {
      loadTrip();
    }
  }, [user, tripId]);

  const loadTrip = async () => {
    if (!user) return;
    try {
      const [tripData, settingsData] = await Promise.all([
        getTrip(tripId),
        getSettings(user.uid),
      ]);
      
      // Recalculate pay to ensure it's always accurate
      if (tripData && settingsData) {
        const mileage = tripData.currentMileage - tripData.startMileage;
        const recalculatedPay = calculateTripPay(mileage, tripData.loads, settingsData);
        
        // Update trip in database if pay is different
        if (Math.abs(tripData.totalPay - recalculatedPay) > 0.01) {
          await updateTrip(tripId, { totalPay: recalculatedPay });
          tripData.totalPay = recalculatedPay;
        }
      }
      
      setTrip(tripData);
      setSettings(settingsData);
    } catch (error) {
      console.error('Error loading trip:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLoad = async () => {
    if (!trip || !settings || !newStops) return;
    const numStops = parseInt(newStops);
    if (isNaN(numStops) || numStops < 1) {
      alert('Please enter a valid number of stops');
      return;
    }

    setUpdating(true);
    try {
      const stops: Stop[] = Array.from({ length: numStops }, (_, i) => ({
        id: `${Date.now()}-${i}`,
      }));

      const newLoad: Load = {
        id: `${Date.now()}`,
        stops,
        loadType,
        createdAt: Timestamp.now(),
      };

      const updatedLoads = [...trip.loads, newLoad];
      const mileage = trip.currentMileage - trip.startMileage;
      const totalPay = calculateTripPay(mileage, updatedLoads, settings);

      await updateTrip(tripId, {
        loads: updatedLoads,
        totalPay,
      });

      setTrip({ ...trip, loads: updatedLoads, totalPay });
      setNewStops('');
      setLoadType('dry');
      setShowAddLoad(false);
    } catch (error) {
      console.error('Error adding load:', error);
      alert('Failed to add load. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateMileage = async () => {
    if (!trip || !settings || !newMileage) return;
    const mileage = parseFloat(newMileage);
    if (isNaN(mileage) || mileage < trip.startMileage) {
      alert('Please enter a valid mileage greater than start mileage');
      return;
    }

    setUpdating(true);
    try {
      const tripMileage = mileage - trip.startMileage;
      const totalPay = calculateTripPay(tripMileage, trip.loads, settings);

      await updateTrip(tripId, {
        currentMileage: mileage,
        totalPay,
      });

      setTrip({ ...trip, currentMileage: mileage, totalPay });
      setNewMileage('');
      setShowUpdateMileage(false);
    } catch (error) {
      console.error('Error updating mileage:', error);
      alert('Failed to update mileage. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const handleFinishTrip = async () => {
    if (!trip || !settings || !newMileage) return;
    const endMileage = parseFloat(newMileage);
    if (isNaN(endMileage) || endMileage < trip.startMileage) {
      alert('Please enter a valid final mileage');
      return;
    }

    setUpdating(true);
    try {
      const tripMileage = endMileage - trip.startMileage;
      const totalPay = calculateTripPay(tripMileage, trip.loads, settings);

      await updateTrip(tripId, {
        endMileage,
        currentMileage: endMileage,
        totalPay,
        isFinished: true,
        finishedAt: Timestamp.now(),
      });

      alert(`Trip completed! Final pay: ${formatCurrency(totalPay)}`);
      onFinishTrip();
    } catch (error) {
      console.error('Error finishing trip:', error);
      alert('Failed to finish trip. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const handleEditLoad = async (loadId: string) => {
    if (!trip || !settings || !editStops) return;
    const numStops = parseInt(editStops);
    if (isNaN(numStops) || numStops < 1) {
      alert('Please enter a valid number of stops');
      return;
    }

    setUpdating(true);
    try {
      const stops: Stop[] = Array.from({ length: numStops }, (_, i) => ({
        id: `${Date.now()}-${i}`,
      }));

      const updatedLoads = trip.loads.map(load =>
        load.id === loadId ? { ...load, stops } : load
      );

      const mileage = trip.currentMileage - trip.startMileage;
      const totalPay = calculateTripPay(mileage, updatedLoads, settings);

      await updateTrip(tripId, {
        loads: updatedLoads,
        totalPay,
      });

      setTrip({ ...trip, loads: updatedLoads, totalPay });
      setEditStops('');
      setShowEditLoad(null);
    } catch (error) {
      console.error('Error editing load:', error);
      alert('Failed to edit load. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteLoad = async (loadId: string) => {
    if (!trip || !settings) return;
    if (!confirm('Are you sure you want to delete this load? This will also delete all stops in this load.')) return;

    setUpdating(true);
    try {
      const updatedLoads = trip.loads.filter(load => load.id !== loadId);
      const mileage = trip.currentMileage - trip.startMileage;
      const totalPay = calculateTripPay(mileage, updatedLoads, settings);

      await updateTrip(tripId, {
        loads: updatedLoads,
        totalPay,
      });

      setTrip({ ...trip, loads: updatedLoads, totalPay });
    } catch (error) {
      console.error('Error deleting load:', error);
      alert('Failed to delete load. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteStop = async (loadId: string, stopId: string) => {
    if (!trip || !settings) return;
    if (!confirm('Are you sure you want to delete this stop?')) return;

    setUpdating(true);
    try {
      const updatedLoads = trip.loads.map(load => {
        if (load.id === loadId) {
          const updatedStops = load.stops.filter(stop => stop.id !== stopId);
          return { ...load, stops: updatedStops };
        }
        return load;
      });

      const mileage = trip.currentMileage - trip.startMileage;
      const totalPay = calculateTripPay(mileage, updatedLoads, settings);

      await updateTrip(tripId, {
        loads: updatedLoads,
        totalPay,
      });

      setTrip({ ...trip, loads: updatedLoads, totalPay });
    } catch (error) {
      console.error('Error deleting stop:', error);
      alert('Failed to delete stop. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading || !trip || !settings) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  const mileage = trip.currentMileage - trip.startMileage;

  return (
    <div className="min-h-screen p-6 pb-32 relative">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <motion.button
            whileHover={{ scale: 1.05, x: -5 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push('/dashboard')}
            className="glass rounded-xl px-4 py-2 text-white/90 hover:text-white transition-all border border-white/10 hover:border-white/30 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </motion.button>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-white via-blue-200 to-purple-200 bg-clip-text text-transparent">
            Trip Details
          </h1>
          <div className="w-24" />
        </motion.div>

        {/* Trip Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-strong rounded-3xl p-8 shadow-2xl border border-white/10 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full blur-3xl" />
          <div className="relative z-10">
            <div className="text-center mb-8">
              <p className="text-gray-400 text-sm font-medium mb-3">Total Pay</p>
              <div className="text-7xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
                {formatCurrency(trip.totalPay)}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6 mb-6">
              <div className="glass rounded-2xl p-6 border border-white/10">
                <p className="text-gray-400 text-sm mb-2">Start Mileage</p>
                <p className="text-2xl font-bold text-white">{trip.startMileage.toLocaleString()}</p>
              </div>
              <div className="glass rounded-2xl p-6 border border-white/10">
                <p className="text-gray-400 text-sm mb-2">Current Mileage</p>
                <p className="text-2xl font-bold text-white">{trip.currentMileage.toLocaleString()}</p>
              </div>
              <div className="glass rounded-2xl p-6 border border-white/10">
                <p className="text-gray-400 text-sm mb-2">Trip Mileage</p>
                <p className="text-2xl font-bold text-white">{mileage.toLocaleString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="glass rounded-2xl p-4 border border-white/10">
                <p className="text-gray-400 text-xs mb-1">Trip Started</p>
                <p className="text-sm font-medium text-white">
                  {trip.createdAt ? formatDateTime(trip.createdAt.toDate()) : 'N/A'}
                </p>
              </div>
              {trip.isFinished && trip.finishedAt && (
                <div className="glass rounded-2xl p-4 border border-white/10">
                  <p className="text-gray-400 text-xs mb-1">Trip Finished</p>
                  <p className="text-sm font-medium text-white">
                    {formatDateTime(trip.finishedAt.toDate())}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setNewMileage(trip.currentMileage.toString());
                setShowUpdateMileage(true);
              }}
              className="flex-1 glass hover:border-white/30 border border-white/10 text-white font-semibold py-4 rounded-xl transition-all"
            >
              Update Mileage
            </motion.button>
              {!trip.isFinished && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setNewMileage(trip.currentMileage.toString());
                    setShowFinishTrip(true);
                  }}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-4 rounded-xl transition-all shadow-lg"
                >
                  Finish Trip
                </motion.button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Loads Section */}
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-white">Loads</h2>
            {!trip.isFinished && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowAddLoad(true)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold px-6 py-3 rounded-xl hover:shadow-lg transition-all flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Load
              </motion.button>
            )}
          </div>

          {trip.loads.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-strong rounded-3xl p-12 text-center border border-white/10"
            >
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <p className="text-gray-400 text-lg">No loads yet. Add your first load!</p>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {trip.loads.map((load, index) => (
                <motion.div
                  key={load.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="glass-strong rounded-3xl p-6 border border-white/10 hover:border-white/20 transition-all group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="text-2xl font-bold text-white">
                          Load {index + 1}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${
                          load.loadType === 'wet' 
                            ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' 
                            : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        }`}>
                          {load.loadType === 'wet' ? '💧 Wet' : '📦 Dry'}
                        </span>
                        <span className="px-3 py-1 rounded-full text-sm font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          {load.stops.length} {load.stops.length === 1 ? 'stop' : 'stops'}
                        </span>
                      </div>
                      {load.createdAt && (
                        <p className="text-gray-400 text-sm">
                          Created: {formatDateTime(load.createdAt.toDate())}
                        </p>
                      )}
                    </div>
                    {!trip.isFinished && (
                      <div className="flex gap-2">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => {
                            setEditStops(load.stops.length.toString());
                            setShowEditLoad(load.id);
                          }}
                          className="p-2 glass hover:border-blue-500/50 border border-white/10 text-blue-400 rounded-lg transition-all"
                          title="Edit Load"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleDeleteLoad(load.id)}
                          disabled={updating}
                          className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all border border-red-500/30 disabled:opacity-50"
                          title="Delete Load"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </motion.button>
                      </div>
                    )}
                  </div>

                  {/* Stops List */}
                  {load.stops.length > 0 && (
                    <div className="space-y-2 mt-4">
                      <p className="text-gray-400 text-sm font-medium mb-2">Stops:</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {load.stops.map((stop, stopIndex) => (
                          <motion.div
                            key={stop.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="glass rounded-xl p-3 border border-white/10 flex items-center justify-between group/stop"
                          >
                            <span className="text-white font-medium">Stop {stopIndex + 1}</span>
                            {!trip.isFinished && (
                              <motion.button
                                whileHover={{ scale: 1.2 }}
                                whileTap={{ scale: 0.8 }}
                                onClick={() => handleDeleteStop(load.id, stop.id)}
                                disabled={updating}
                                className="opacity-0 group-hover/stop:opacity-100 text-red-400 hover:text-red-300 transition-all p-1"
                                title="Delete Stop"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </motion.button>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Load Modal */}
      <AnimatePresence>
        {showAddLoad && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setShowAddLoad(false)}
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
                <h2 className="text-3xl font-bold text-white mb-6">Add New Load</h2>
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-300 mb-3">
                    Load Type
                  </label>
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setLoadType('wet')}
                      className={`py-4 rounded-xl font-semibold transition-all border-2 ${
                        loadType === 'wet'
                          ? 'bg-blue-500/30 border-blue-500 text-blue-300'
                          : 'glass border-white/10 text-gray-400 hover:border-blue-500/50'
                      }`}
                    >
                      💧 Wet Load
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setLoadType('dry')}
                      className={`py-4 rounded-xl font-semibold transition-all border-2 ${
                        loadType === 'dry'
                          ? 'bg-amber-500/30 border-amber-500 text-amber-300'
                          : 'glass border-white/10 text-gray-400 hover:border-amber-500/50'
                      }`}
                    >
                      📦 Dry Load
                    </motion.button>
                  </div>
                  <label className="block text-sm font-semibold text-gray-300 mb-3">
                    Number of Stops
                  </label>
                  <input
                    type="number"
                    value={newStops}
                    onChange={(e) => setNewStops(e.target.value)}
                    className="w-full px-4 py-4 bg-dark-700/50 border-2 border-dark-600 rounded-xl focus:border-blue-500 focus:outline-none text-white text-lg"
                    placeholder="Enter number of stops"
                    min="1"
                  />
                </div>
                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowAddLoad(false)}
                    className="flex-1 glass hover:border-white/30 border border-white/10 text-gray-300 font-semibold py-3 rounded-xl transition-all"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleAddLoad}
                    disabled={updating}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50 shadow-lg"
                  >
                    {updating ? 'Adding...' : 'Add Load'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Update Mileage Modal */}
      <AnimatePresence>
        {showUpdateMileage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setShowUpdateMileage(false)}
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
                <h2 className="text-3xl font-bold text-white mb-6">Update Mileage</h2>
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-300 mb-3">
                    Current Odometer
                  </label>
                  <input
                    type="number"
                    value={newMileage}
                    onChange={(e) => setNewMileage(e.target.value)}
                    className="w-full px-4 py-4 bg-dark-700/50 border-2 border-dark-600 rounded-xl focus:border-blue-500 focus:outline-none text-white text-lg"
                    placeholder="Enter current mileage"
                    min={trip.startMileage}
                  />
                </div>
                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowUpdateMileage(false)}
                    className="flex-1 glass hover:border-white/30 border border-white/10 text-gray-300 font-semibold py-3 rounded-xl transition-all"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleUpdateMileage}
                    disabled={updating}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50 shadow-lg"
                  >
                    {updating ? 'Updating...' : 'Update'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Finish Trip Modal */}
      <AnimatePresence>
        {showFinishTrip && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setShowFinishTrip(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong rounded-3xl p-8 max-w-md w-full border border-white/20 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-green-500/20 to-blue-500/20 rounded-full blur-3xl" />
              <div className="relative z-10">
                <h2 className="text-3xl font-bold text-white mb-6">Finish Trip</h2>
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-300 mb-3">
                    Final Odometer
                  </label>
                  <input
                    type="number"
                    value={newMileage}
                    onChange={(e) => setNewMileage(e.target.value)}
                    className="w-full px-4 py-4 bg-dark-700/50 border-2 border-dark-600 rounded-xl focus:border-green-500 focus:outline-none text-white text-lg"
                    placeholder="Enter final mileage"
                    min={trip.startMileage}
                  />
                </div>
                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowFinishTrip(false)}
                    className="flex-1 glass hover:border-white/30 border border-white/10 text-gray-300 font-semibold py-3 rounded-xl transition-all"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleFinishTrip}
                    disabled={updating}
                    className="flex-1 bg-gradient-to-r from-green-600 to-blue-600 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50 shadow-lg"
                  >
                    {updating ? 'Finishing...' : 'Finish Trip'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Load Modal */}
      <AnimatePresence>
        {showEditLoad && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setShowEditLoad(null)}
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
                <h2 className="text-3xl font-bold text-white mb-6">Edit Load</h2>
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-300 mb-3">
                    Number of Stops
                  </label>
                  <input
                    type="number"
                    value={editStops}
                    onChange={(e) => setEditStops(e.target.value)}
                    className="w-full px-4 py-4 bg-dark-700/50 border-2 border-dark-600 rounded-xl focus:border-blue-500 focus:outline-none text-white text-lg"
                    placeholder="Enter number of stops"
                    min="1"
                  />
                </div>
                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowEditLoad(null)}
                    className="flex-1 glass hover:border-white/30 border border-white/10 text-gray-300 font-semibold py-3 rounded-xl transition-all"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => showEditLoad && handleEditLoad(showEditLoad)}
                    disabled={updating}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50 shadow-lg"
                  >
                    {updating ? 'Updating...' : 'Update Load'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

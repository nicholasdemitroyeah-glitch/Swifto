'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { getTrip, updateTrip, getSettings, Trip, Settings, Load, Stop } from '@/lib/db';
import { calculateTripPay, formatCurrency, formatDateTime } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Timestamp } from 'firebase/firestore';
import { hapticLight, hapticMedium, hapticSuccess, hapticError } from '@/lib/haptics';

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
      
      if (tripData && settingsData) {
        const mileage = tripData.currentMileage - tripData.startMileage;
        const recalculatedPay = calculateTripPay(mileage, tripData.loads, settingsData);
        
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
      hapticSuccess();
    } catch (error) {
      console.error('Error adding load:', error);
      alert('Failed to add load. Please try again.');
      hapticError();
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
      hapticSuccess();
    } catch (error) {
      console.error('Error updating mileage:', error);
      alert('Failed to update mileage. Please try again.');
      hapticError();
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

      hapticSuccess();
      alert(`Trip completed! Final pay: ${formatCurrency(totalPay)}`);
      onFinishTrip();
    } catch (error) {
      console.error('Error finishing trip:', error);
      alert('Failed to finish trip. Please try again.');
      hapticError();
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
      hapticSuccess();
    } catch (error) {
      console.error('Error editing load:', error);
      alert('Failed to edit load. Please try again.');
      hapticError();
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteLoad = async (loadId: string) => {
    if (!trip || !settings) return;
    if (!confirm('Delete this load?')) return;

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
      hapticSuccess();
    } catch (error) {
      console.error('Error deleting load:', error);
      alert('Failed to delete load. Please try again.');
      hapticError();
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteStop = async (loadId: string, stopId: string) => {
    if (!trip || !settings) return;

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
      <div className="h-full flex items-center justify-center bg-black">
        <div className="text-white text-base">Loading...</div>
      </div>
    );
  }

  const mileage = trip.currentMileage - trip.startMileage;

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Fixed Header */}
      <div className="flex-shrink-0 safe-top safe-left safe-right">
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center justify-between mb-3">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => { hapticLight(); router.push('/dashboard'); }}
              className="glass rounded-xl px-3 py-2 text-white/90 active:opacity-70 flex items-center gap-1.5"
              style={{ fontSize: '14px', fontWeight: 500 }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </motion.button>
            <h1 className="text-xl font-bold text-white tracking-tight" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif', fontWeight: 700, letterSpacing: '-0.02em' }}>
              Trip Details
            </h1>
            <div className="w-16" />
          </div>

          {/* Trip Info Card - Compact */}
          <div className="glass rounded-2xl p-4 mb-3">
            <div className="text-center mb-4">
              <p className="text-white/60 text-xs font-medium mb-1">Total Pay</p>
              <div className="text-3xl font-bold text-white" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif', fontWeight: 700, letterSpacing: '-0.03em' }}>
                {formatCurrency(trip.totalPay)}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="glass rounded-xl p-2.5">
                <p className="text-white/60 text-xs mb-0.5">Start</p>
                <p className="text-base font-bold text-white">{trip.startMileage.toLocaleString()}</p>
              </div>
              <div className="glass rounded-xl p-2.5">
                <p className="text-white/60 text-xs mb-0.5">Current</p>
                <p className="text-base font-bold text-white">{trip.currentMileage.toLocaleString()}</p>
              </div>
              <div className="glass rounded-xl p-2.5">
                <p className="text-white/60 text-xs mb-0.5">Trip</p>
                <p className="text-base font-bold text-white">{mileage.toLocaleString()}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => { hapticLight(); setNewMileage(trip.currentMileage.toString()); setShowUpdateMileage(true); }}
                className="flex-1 glass rounded-xl px-3 py-2.5 text-white text-sm font-medium active:opacity-70"
                style={{ fontSize: '14px', fontWeight: 500 }}
              >
                Update Mileage
              </motion.button>
              {!trip.isFinished && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { hapticMedium(); setNewMileage(trip.currentMileage.toString()); setShowFinishTrip(true); }}
                  className="flex-1 glass rounded-xl px-3 py-2.5 text-white text-sm font-medium active:opacity-70"
                  style={{ fontSize: '14px', fontWeight: 500 }}
                >
                  Finish Trip
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 scroll-area safe-left safe-right safe-bottom">
        <div className="px-4 pb-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-bold text-white tracking-tight" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif', fontWeight: 700 }}>
              Loads
            </h2>
            {!trip.isFinished && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => { hapticMedium(); setShowAddLoad(true); }}
                className="glass rounded-xl px-3 py-2 text-white font-medium active:opacity-70 flex items-center gap-1.5"
                style={{ fontSize: '14px', fontWeight: 500 }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add
              </motion.button>
            )}
          </div>

          {trip.loads.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white/5 flex items-center justify-center">
                <svg className="w-7 h-7 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <p className="text-white/60 text-sm">No loads yet. Add your first load!</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {trip.loads.map((load, index) => (
                <div key={load.id} className="glass rounded-2xl p-3.5">
                  <div className="flex justify-between items-start mb-2.5">
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <h3 className="text-base font-semibold text-white" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif', fontWeight: 600 }}>
                          Load {index + 1}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          load.loadType === 'wet' 
                            ? 'bg-blue-500/20 text-blue-400' 
                            : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {load.loadType === 'wet' ? '💧 Wet' : '📦 Dry'}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-white/90">
                          {load.stops.length} {load.stops.length === 1 ? 'stop' : 'stops'}
                        </span>
                      </div>
                      {load.createdAt && (
                        <p className="text-white/40 text-xs">
                          {formatDateTime(load.createdAt.toDate())}
                        </p>
                      )}
                    </div>
                    {!trip.isFinished && (
                      <div className="flex gap-1.5 flex-shrink-0">
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => { hapticLight(); setEditStops(load.stops.length.toString()); setShowEditLoad(load.id); }}
                          className="p-2 glass rounded-lg text-white/90 active:opacity-70"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleDeleteLoad(load.id)}
                          disabled={updating}
                          className="p-2 glass rounded-lg text-red-400 active:opacity-70 disabled:opacity-50"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </motion.button>
                      </div>
                    )}
                  </div>

                  {/* Stops List */}
                  {load.stops.length > 0 && (
                    <div className="space-y-1.5 mt-2.5 pt-2.5 border-t border-white/10">
                      <p className="text-white/50 text-xs font-medium mb-1.5">Stops:</p>
                      <div className="space-y-1">
                        {load.stops.map((stop, stopIndex) => (
                          <div key={stop.id} className="flex items-center justify-between glass rounded-lg px-2.5 py-2">
                            <span className="text-white/80 text-xs">Stop {stopIndex + 1}</span>
                            {!trip.isFinished && (
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleDeleteStop(load.id, stop.id)}
                                disabled={updating}
                                className="p-1 glass rounded text-red-400 active:opacity-70 disabled:opacity-50"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </motion.button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals - Bottom Sheets on Mobile */}
      <AnimatePresence>
        {showAddLoad && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 safe-bottom"
            onClick={() => { hapticLight(); setShowAddLoad(false); }}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-0 left-0 right-0 glass rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="w-12 h-1 bg-white/30 rounded-full mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-white mb-5" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif', fontWeight: 700 }}>
                Add New Load
              </h2>
              <div className="mb-5">
                <label className="block text-sm font-medium text-white/90 mb-3" style={{ fontSize: '15px', fontWeight: 500 }}>
                  Load Type
                </label>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { hapticLight(); setLoadType('wet'); }}
                    className={`py-4 rounded-xl font-medium border ${loadType === 'wet' ? 'bg-blue-500/30 border-blue-500 text-blue-300' : 'glass border-white/10 text-white/60 active:opacity-70'}`}
                    style={{ fontSize: '15px', fontWeight: 500 }}
                  >
                    💧 Wet Load
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { hapticLight(); setLoadType('dry'); }}
                    className={`py-4 rounded-xl font-medium border ${loadType === 'dry' ? 'bg-amber-500/30 border-amber-500 text-amber-300' : 'glass border-white/10 text-white/60 active:opacity-70'}`}
                    style={{ fontSize: '15px', fontWeight: 500 }}
                  >
                    📦 Dry Load
                  </motion.button>
                </div>
                <label className="block text-sm font-medium text-white/90 mb-3" style={{ fontSize: '15px', fontWeight: 500 }}>
                  Number of Stops
                </label>
                <input
                  type="number"
                  value={newStops}
                  onChange={(e) => setNewStops(e.target.value)}
                  className="w-full px-4 py-4 glass rounded-xl border border-white/10 focus:border-blue-500 focus:outline-none text-white"
                  placeholder="Enter number of stops"
                  min="1"
                  style={{ fontSize: '17px' }}
                />
              </div>
              <div className="flex gap-3">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { hapticLight(); setShowAddLoad(false); }}
                  className="flex-1 glass rounded-xl text-white/90 font-medium py-3.5 active:opacity-70"
                  style={{ fontSize: '17px', fontWeight: 500 }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { hapticMedium(); handleAddLoad(); }}
                  disabled={updating}
                  className="flex-1 glass rounded-xl text-white font-medium py-3.5 active:opacity-70 disabled:opacity-50"
                  style={{ fontSize: '17px', fontWeight: 600 }}
                >
                  {updating ? 'Adding...' : 'Add Load'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showUpdateMileage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 safe-bottom"
            onClick={() => { hapticLight(); setShowUpdateMileage(false); }}
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
                Update Mileage
              </h2>
              <div className="mb-5">
                <label className="block text-sm font-medium text-white/90 mb-3" style={{ fontSize: '15px', fontWeight: 500 }}>
                  Current Odometer
                </label>
                <input
                  type="number"
                  value={newMileage}
                  onChange={(e) => setNewMileage(e.target.value)}
                  className="w-full px-4 py-4 glass rounded-xl border border-white/10 focus:border-blue-500 focus:outline-none text-white"
                  placeholder="Enter current mileage"
                  min={trip.startMileage}
                  style={{ fontSize: '17px' }}
                />
              </div>
              <div className="flex gap-3">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { hapticLight(); setShowUpdateMileage(false); }}
                  className="flex-1 glass rounded-xl text-white/90 font-medium py-3.5 active:opacity-70"
                  style={{ fontSize: '17px', fontWeight: 500 }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { hapticMedium(); handleUpdateMileage(); }}
                  disabled={updating}
                  className="flex-1 glass rounded-xl text-white font-medium py-3.5 active:opacity-70 disabled:opacity-50"
                  style={{ fontSize: '17px', fontWeight: 600 }}
                >
                  {updating ? 'Updating...' : 'Update'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showFinishTrip && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 safe-bottom"
            onClick={() => { hapticLight(); setShowFinishTrip(false); }}
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
                Finish Trip
              </h2>
              <div className="mb-5">
                <label className="block text-sm font-medium text-white/90 mb-3" style={{ fontSize: '15px', fontWeight: 500 }}>
                  Final Odometer
                </label>
                <input
                  type="number"
                  value={newMileage}
                  onChange={(e) => setNewMileage(e.target.value)}
                  className="w-full px-4 py-4 glass rounded-xl border border-white/10 focus:border-green-500 focus:outline-none text-white"
                  placeholder="Enter final mileage"
                  min={trip.startMileage}
                  style={{ fontSize: '17px' }}
                />
              </div>
              <div className="flex gap-3">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { hapticLight(); setShowFinishTrip(false); }}
                  className="flex-1 glass rounded-xl text-white/90 font-medium py-3.5 active:opacity-70"
                  style={{ fontSize: '17px', fontWeight: 500 }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { hapticMedium(); handleFinishTrip(); }}
                  disabled={updating}
                  className="flex-1 glass rounded-xl text-white font-medium py-3.5 active:opacity-70 disabled:opacity-50"
                  style={{ fontSize: '17px', fontWeight: 600 }}
                >
                  {updating ? 'Finishing...' : 'Finish Trip'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showEditLoad && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 safe-bottom"
            onClick={() => { hapticLight(); setShowEditLoad(null); }}
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
                Edit Load
              </h2>
              <div className="mb-5">
                <label className="block text-sm font-medium text-white/90 mb-3" style={{ fontSize: '15px', fontWeight: 500 }}>
                  Number of Stops
                </label>
                <input
                  type="number"
                  value={editStops}
                  onChange={(e) => setEditStops(e.target.value)}
                  className="w-full px-4 py-4 glass rounded-xl border border-white/10 focus:border-blue-500 focus:outline-none text-white"
                  placeholder="Enter number of stops"
                  min="1"
                  style={{ fontSize: '17px' }}
                />
              </div>
              <div className="flex gap-3">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { hapticLight(); setShowEditLoad(null); }}
                  className="flex-1 glass rounded-xl text-white/90 font-medium py-3.5 active:opacity-70"
                  style={{ fontSize: '17px', fontWeight: 500 }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => showEditLoad && handleEditLoad(showEditLoad)}
                  disabled={updating}
                  className="flex-1 glass rounded-xl text-white font-medium py-3.5 active:opacity-70 disabled:opacity-50"
                  style={{ fontSize: '17px', fontWeight: 600 }}
                >
                  {updating ? 'Updating...' : 'Update Load'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

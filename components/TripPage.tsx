'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { getTrip, updateTrip, getSettings, Trip, Settings, Load, Stop } from '@/lib/db';
import { calculateTripPay, formatCurrency, formatDateTime, isInNightWindow } from '@/lib/utils';
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
        const nightMiles = tripData.nightMiles || 0;
        const recalculatedPay = calculateTripPay(mileage, tripData.loads, settingsData, nightMiles);
        
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
      const totalPay = calculateTripPay(mileage, updatedLoads, settings, trip.nightMiles || 0);

      await updateTrip(tripId, { loads: updatedLoads, totalPay });
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
      alert('Please enter a valid mileage');
      return;
    }

    setUpdating(true);
    try {
      const previousMileage = trip.currentMileage;
      const delta = Math.max(0, mileage - previousMileage);

      // Categorize delta miles based on current time window
      const now = new Date();
      const nightIncrement = (settings.nightPayEnabled && delta > 0 && isInNightWindow(now, settings)) ? delta : 0;
      const newNightMiles = (trip.nightMiles || 0) + nightIncrement;

      const tripMileage = mileage - trip.startMileage;
      const totalPay = calculateTripPay(tripMileage, trip.loads, settings, newNightMiles);
      await updateTrip(tripId, { currentMileage: mileage, totalPay, nightMiles: newNightMiles });
      setTrip({ ...trip, currentMileage: mileage, totalPay, nightMiles: newNightMiles });
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
      const previousMileage = trip.currentMileage;
      const delta = Math.max(0, endMileage - previousMileage);

      const now = new Date();
      const nightIncrement = (settings.nightPayEnabled && delta > 0 && isInNightWindow(now, settings)) ? delta : 0;
      const newNightMiles = (trip.nightMiles || 0) + nightIncrement;

      const tripMileage = endMileage - trip.startMileage;
      const totalPay = calculateTripPay(tripMileage, trip.loads, settings, newNightMiles);
      await updateTrip(tripId, {
        endMileage,
        currentMileage: endMileage,
        totalPay,
        nightMiles: newNightMiles,
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
      const totalPay = calculateTripPay(mileage, updatedLoads, settings, trip.nightMiles || 0);
      await updateTrip(tripId, { loads: updatedLoads, totalPay });
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
      const totalPay = calculateTripPay(mileage, updatedLoads, settings, trip.nightMiles || 0);
      await updateTrip(tripId, { loads: updatedLoads, totalPay });
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
          return { ...load, stops: load.stops.filter(stop => stop.id !== stopId) };
        }
        return load;
      });
      const mileage = trip.currentMileage - trip.startMileage;
      const totalPay = calculateTripPay(mileage, updatedLoads, settings);
      await updateTrip(tripId, { loads: updatedLoads, totalPay });
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
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  const mileage = trip.currentMileage - trip.startMileage;

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Top Bar */}
      <div className="flex-shrink-0 safe-top">
        <div className="px-4 pt-2 pb-3">
          <div className="flex items-center justify-between mb-3">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => { hapticLight(); router.push('/dashboard'); }}
              className="w-10 h-10 glass rounded-xl flex items-center justify-center text-white/90"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </motion.button>
            <h1 className="text-xl font-bold text-white" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif', fontWeight: 700 }}>
              Trip
            </h1>
            <div className="w-10" />
          </div>

          {/* Pay Card */}
          <div className="glass rounded-2xl p-4 mb-3">
            <div className="text-center mb-3">
              <p className="text-white/60 text-xs mb-1">Total Pay</p>
              <div className="text-3xl font-bold text-white" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif', fontWeight: 700 }}>
                {formatCurrency(trip.totalPay)}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center">
                <p className="text-white/50 text-xs">Start</p>
                <p className="text-sm font-bold text-white">{trip.startMileage.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-white/50 text-xs">Current</p>
                <p className="text-sm font-bold text-white">{trip.currentMileage.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-white/50 text-xs">Trip</p>
                <p className="text-sm font-bold text-white">{mileage.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => { hapticLight(); setNewMileage(trip.currentMileage.toString()); setShowUpdateMileage(true); }}
                className="flex-1 glass rounded-xl px-3 py-2.5 text-white text-sm font-medium"
              >
                Update
              </motion.button>
              {!trip.isFinished && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { hapticMedium(); setNewMileage(trip.currentMileage.toString()); setShowFinishTrip(true); }}
                  className="flex-1 glass rounded-xl px-3 py-2.5 text-white text-sm font-medium"
                >
                  Finish
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Loads */}
      <div className="flex-1 scroll-area safe-left safe-right safe-bottom">
        <div className="px-4 pb-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-bold text-white" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif', fontWeight: 700 }}>
              Loads
            </h2>
            {!trip.isFinished && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => { hapticMedium(); setShowAddLoad(true); }}
                className="w-10 h-10 glass rounded-xl flex items-center justify-center text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </motion.button>
            )}
          </div>

          {trip.loads.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center">
              <p className="text-white/60 text-sm">No loads yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {trip.loads.map((load, index) => (
                <div key={load.id} className="glass rounded-2xl p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-white">Load {index + 1}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${load.loadType === 'wet' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {load.loadType === 'wet' ? '💧' : '📦'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-white/90">
                        {load.stops.length} stops
                      </span>
                    </div>
                    {!trip.isFinished && (
                      <div className="flex gap-1">
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => { hapticLight(); setEditStops(load.stops.length.toString()); setShowEditLoad(load.id); }}
                          className="p-2 glass rounded-lg text-white/90"
                        >
                          ✏️
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleDeleteLoad(load.id)}
                          className="p-2 glass rounded-lg text-red-400"
                        >
                          🗑️
                        </motion.button>
                      </div>
                    )}
                  </div>
                  {load.stops.length > 0 && (
                    <div className="space-y-1 mt-2 pt-2 border-t border-white/10">
                      {load.stops.map((stop, stopIndex) => (
                        <div key={stop.id} className="flex items-center justify-between glass rounded-lg px-2.5 py-1.5">
                          <span className="text-white/80 text-xs">Stop {stopIndex + 1}</span>
                          {!trip.isFinished && (
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleDeleteStop(load.id, stop.id)}
                              className="text-red-400 text-xs"
                            >
                              ×
                            </motion.button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Sheet Modals */}
      <AnimatePresence>
        {showAddLoad && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 safe-bottom"
            onClick={() => { hapticLight(); setShowAddLoad(false); }}
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
              <h2 className="text-2xl font-bold text-white mb-5">Add Load</h2>
              <div className="mb-5">
                <label className="block text-sm font-medium text-white/90 mb-3">Load Type</label>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { hapticLight(); setLoadType('wet'); }}
                    className={`py-4 rounded-xl font-medium border ${loadType === 'wet' ? 'bg-blue-500/30 border-blue-500 text-blue-300' : 'glass border-white/10 text-white/60'}`}
                  >
                    💧 Wet
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { hapticLight(); setLoadType('dry'); }}
                    className={`py-4 rounded-xl font-medium border ${loadType === 'dry' ? 'bg-amber-500/30 border-amber-500 text-amber-300' : 'glass border-white/10 text-white/60'}`}
                  >
                    📦 Dry
                  </motion.button>
                </div>
                <label className="block text-sm font-medium text-white/90 mb-3">Number of Stops</label>
                <input
                  type="number"
                  value={newStops}
                  onChange={(e) => setNewStops(e.target.value)}
                  className="w-full px-4 py-4 glass rounded-xl border border-white/10 focus:border-blue-500 focus:outline-none text-white"
                  placeholder="Enter stops"
                  min="1"
                  style={{ fontSize: '17px' }}
                />
              </div>
              <div className="flex gap-3">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { hapticLight(); setShowAddLoad(false); }}
                  className="flex-1 glass rounded-xl text-white/90 font-medium py-3.5"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { hapticMedium(); handleAddLoad(); }}
                  disabled={updating}
                  className="flex-1 glass rounded-xl text-white font-medium py-3.5 disabled:opacity-50"
                >
                  {updating ? 'Adding...' : 'Add'}
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
            className="fixed inset-0 bg-black/80 z-50 safe-bottom"
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
              <h2 className="text-2xl font-bold text-white mb-5">Update Mileage</h2>
              <div className="mb-5">
                <label className="block text-sm font-medium text-white/90 mb-3">Current Odometer</label>
                <input
                  type="number"
                  value={newMileage}
                  onChange={(e) => setNewMileage(e.target.value)}
                  className="w-full px-4 py-4 glass rounded-xl border border-white/10 focus:border-blue-500 focus:outline-none text-white"
                  placeholder="Enter mileage"
                  min={trip.startMileage}
                  style={{ fontSize: '17px' }}
                />
              </div>
              <div className="flex gap-3">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { hapticLight(); setShowUpdateMileage(false); }}
                  className="flex-1 glass rounded-xl text-white/90 font-medium py-3.5"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { hapticMedium(); handleUpdateMileage(); }}
                  disabled={updating}
                  className="flex-1 glass rounded-xl text-white font-medium py-3.5 disabled:opacity-50"
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
            className="fixed inset-0 bg-black/80 z-50 safe-bottom"
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
              <h2 className="text-2xl font-bold text-white mb-5">Finish Trip</h2>
              <div className="mb-5">
                <label className="block text-sm font-medium text-white/90 mb-3">Final Odometer</label>
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
                  className="flex-1 glass rounded-xl text-white/90 font-medium py-3.5"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { hapticMedium(); handleFinishTrip(); }}
                  disabled={updating}
                  className="flex-1 glass rounded-xl text-white font-medium py-3.5 disabled:opacity-50"
                >
                  {updating ? 'Finishing...' : 'Finish'}
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
            className="fixed inset-0 bg-black/80 z-50 safe-bottom"
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
              <h2 className="text-2xl font-bold text-white mb-5">Edit Load</h2>
              <div className="mb-5">
                <label className="block text-sm font-medium text-white/90 mb-3">Number of Stops</label>
                <input
                  type="number"
                  value={editStops}
                  onChange={(e) => setEditStops(e.target.value)}
                  className="w-full px-4 py-4 glass rounded-xl border border-white/10 focus:border-blue-500 focus:outline-none text-white"
                  placeholder="Enter stops"
                  min="1"
                  style={{ fontSize: '17px' }}
                />
              </div>
              <div className="flex gap-3">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { hapticLight(); setShowEditLoad(null); }}
                  className="flex-1 glass rounded-xl text-white/90 font-medium py-3.5"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => showEditLoad && handleEditLoad(showEditLoad)}
                  disabled={updating}
                  className="flex-1 glass rounded-xl text-white font-medium py-3.5 disabled:opacity-50"
                >
                  {updating ? 'Updating...' : 'Update'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

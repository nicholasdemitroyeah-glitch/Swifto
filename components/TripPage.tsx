'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { getTrip, updateTrip, getSettings, Trip, Settings, Load, Stop } from '@/lib/db';
import { calculateTripPay, formatCurrency, formatDateTime, isInNightWindow, haversineMiles } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Timestamp } from 'firebase/firestore';
import { hapticLight, hapticMedium, hapticSuccess, hapticError } from '@/lib/haptics';
import { initSounds, playClick, playArrive } from '@/lib/sounds';

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
  const [watchId, setWatchId] = useState<number | null>(null);
  const [trackingMilesBuffer, setTrackingMilesBuffer] = useState(0);
  const [trackingNightMilesBuffer, setTrackingNightMilesBuffer] = useState(0);
  const [lastCoords, setLastCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showStopTracker, setShowStopTracker] = useState(false);
  const [activeLoadId, setActiveLoadId] = useState<string | null>(null);
  const [activeStopId, setActiveStopId] = useState<string | null>(null); // 'dc' indicates return to DC
  const [showArrivedOverlay, setShowArrivedOverlay] = useState<{ type: 'stop' | 'dc'; stopIndex?: number } | null>(null);
  const [screen, setScreen] = useState<'loads' | 'load-detail'>('loads');
  const [openedLoadId, setOpenedLoadId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadTrip();
    }
  }, [user, tripId]);

  useEffect(() => {
    initSounds();
  }, []);

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

  const startTracking = () => {
    if (watchId !== null) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLastCoords((prev) => {
          if (prev) {
            const delta = haversineMiles(prev, coords);
            if (delta > 0) {
              setTrackingMilesBuffer((m) => m + delta);
              const now = new Date();
              if (settings && isInNightWindow(now, settings)) {
                setTrackingNightMilesBuffer((m) => m + delta);
              }
            }
          }
          return coords;
        });
      },
      (err) => {
        console.error('Geolocation error:', err);
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );
    setWatchId(id);
  };

  const stopTracking = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setLastCoords(null);
  };

  const getFirstUnarrivedStopId = (load: Load): string | null => {
    const stop = load.stops.find(s => !('arrivedAt' in s) || !s.arrivedAt);
    return stop ? stop.id : null;
  };

  const handleBeginLoad = async (loadId: string) => {
    if (!trip) return;
    // Mark load started by setting startLocation if missing
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
      });
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const updatedLoads = trip.loads.map(l => l.id === loadId ? { ...l, startLocation: l.startLocation ?? coords } : l);
      await updateTrip(trip.id, { loads: updatedLoads });
      setTrip({ ...trip, loads: updatedLoads });
      // Prepare next stop UI (will show Depart button on that stop)
    } catch {
      // Ignore if user denies permission; they can depart later
    }
  };

  const handleDepartToStop = async (loadId: string, stopId: string) => {
    if (!trip) return;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
      });
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setLastCoords(coords);
      setTrackingMilesBuffer(0);
      setTrackingNightMilesBuffer(0);
      setActiveLoadId(loadId);
      setActiveStopId(stopId);
      startTracking();
      setShowStopTracker(true);
    } catch {
      alert('Location permission is required to start tracking.');
    }
  };

  const handleDepartToDC = async (loadId: string) => {
    if (!trip) return;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
      });
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setLastCoords(coords);
      setTrackingMilesBuffer(0);
      setTrackingNightMilesBuffer(0);
      setActiveLoadId(loadId);
      setActiveStopId('dc');
      startTracking();
      setShowStopTracker(true);
    } catch {
      alert('Location permission is required to start tracking.');
    }
  };

  const handleArriveDc = async () => {
    if (!trip || !settings || !activeLoadId) return;
    setUpdating(true);
    try {
      stopTracking();
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
      });
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };

      const bufferMiles = trackingMilesBuffer;
      const bufferNight = trackingNightMilesBuffer;

      const newCurrentMileage = trip.currentMileage + bufferMiles;
      const newNightMiles = (trip.nightMiles || 0) + bufferNight;

      const updatedLoads = trip.loads.map(l => l.id === activeLoadId ? ({ ...l, finishedAt: Timestamp.now(), finishedLocation: coords }) : l);
      const tripMileage = newCurrentMileage - trip.startMileage;
      const totalPay = calculateTripPay(tripMileage, updatedLoads, settings, newNightMiles);

      await updateTrip(trip.id, {
        loads: updatedLoads,
        currentMileage: newCurrentMileage,
        nightMiles: newNightMiles,
        totalPay,
      });
      setTrip({ ...trip, loads: updatedLoads, currentMileage: newCurrentMileage, nightMiles: newNightMiles, totalPay });
      setTrackingMilesBuffer(0);
      setTrackingNightMilesBuffer(0);
      setShowStopTracker(false);
      setActiveLoadId(null);
      setActiveStopId(null);
      hapticSuccess();
    } catch (e) {
      console.error(e);
      alert('Failed to mark arrival to DC. Please try again.');
      hapticError();
    } finally {
      setUpdating(false);
    }
  };

  const handleDepartStop = async (loadId: string) => {
    if (!trip) return;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
      });
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setLastCoords(coords);
      setTrackingMilesBuffer(0);
      setTrackingNightMilesBuffer(0);
      startTracking();
      // Set load.startLocation if missing
      const updatedLoads = trip.loads.map(l => l.id === loadId ? { ...l, startLocation: l.startLocation ?? coords } : l);
      await updateTrip(trip.id, { loads: updatedLoads, trackingActive: true, trackingLastLocation: coords, trackingMilesBuffer: 0, trackingNightMilesBuffer: 0 });
      setTrip({ ...trip, loads: updatedLoads, trackingActive: true, trackingLastLocation: coords, trackingMilesBuffer: 0, trackingNightMilesBuffer: 0 });
    } catch (e) {
      alert('Location permission is required to start tracking.');
    }
  };

  const handleArriveStop = async (loadId: string, stopId: string) => {
    if (!trip || !settings) return;
    setUpdating(true);
    try {
      stopTracking();
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
      });
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };

      const bufferMiles = trackingMilesBuffer;
      const bufferNight = trackingNightMilesBuffer;

      const newCurrentMileage = trip.currentMileage + bufferMiles;
      const newNightMiles = (trip.nightMiles || 0) + bufferNight;

      const updatedLoads = trip.loads.map(l => {
        if (l.id !== loadId) return l;
        const updatedStops = l.stops.map(s => s.id === stopId ? { ...s, arrivedAt: Timestamp.now(), arrivedLocation: coords } : s);
        return { ...l, stops: updatedStops };
      });
      const tripMileage = newCurrentMileage - trip.startMileage;
      const totalPay = calculateTripPay(tripMileage, updatedLoads, settings, newNightMiles);

      await updateTrip(trip.id, {
        loads: updatedLoads,
        currentMileage: newCurrentMileage,
        nightMiles: newNightMiles,
        totalPay,
        trackingActive: false,
        trackingMilesBuffer: 0,
        trackingNightMilesBuffer: 0,
        trackingLastLocation: null as any
      });
      setTrip({
        ...trip,
        loads: updatedLoads,
        currentMileage: newCurrentMileage,
        nightMiles: newNightMiles,
        totalPay,
        trackingActive: false,
        trackingMilesBuffer: 0,
        trackingNightMilesBuffer: 0,
        trackingLastLocation: undefined
      });
      setTrackingMilesBuffer(0);
      setTrackingNightMilesBuffer(0);
      hapticSuccess();
    } catch (e) {
      console.error(e);
      alert('Failed to mark arrival. Please try again.');
      hapticError();
    } finally {
      setUpdating(false);
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
    if (!trip || !settings) return;
    const provided = newMileage ? parseFloat(newMileage) : NaN;
    if (newMileage && (isNaN(provided) || provided < trip.startMileage)) {
      alert('Please enter a valid final mileage');
      return;
    }

    setUpdating(true);
    try {
      // Stop live tracking if active, and add buffered miles
      stopTracking();
      const bufferMiles = trackingMilesBuffer;
      const bufferNight = trackingNightMilesBuffer;

      const previousOdo = trip.currentMileage;
      let computedOdo = previousOdo + bufferMiles;
      let nightMiles = (trip.nightMiles || 0) + bufferNight;

      // If user provided final odometer, trust that and compare
      if (!isNaN(provided)) {
        // Compare tracking distance vs provided
        const trackedTripMiles = computedOdo - trip.startMileage;
        const providedTripMiles = provided - trip.startMileage;
        const diff = Math.abs(providedTripMiles - trackedTripMiles);
        if (diff > 1) {
          // Optional: inform about discrepancy (silent in UI here)
          console.log('Tracked vs provided miles differ by', diff.toFixed(2));
        }
        computedOdo = provided;
        // For simplicity, keep nightMiles as accumulated from tracking buffer
      }

      const tripMileage = computedOdo - trip.startMileage;
      const totalPay = calculateTripPay(tripMileage, trip.loads, settings, nightMiles);

      await updateTrip(tripId, {
        endMileage: computedOdo,
        currentMileage: computedOdo,
        totalPay,
        nightMiles,
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
                  className="flex-1 rounded-xl px-3 py-2.5 text-white text-sm font-medium bg-blue-600"
              >
                Update
              </motion.button>
              {!trip.isFinished && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { hapticMedium(); setNewMileage(trip.currentMileage.toString()); setShowFinishTrip(true); }}
                    className="flex-1 rounded-xl px-3 py-2.5 text-white text-sm font-medium bg-blue-600"
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
          {screen === 'loads' && (
          <>
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
                      {trip.loads.map((load, index) => {
                        const firstUnarrivedId = getFirstUnarrivedStopId(load);
                        const allStopsArrived = !firstUnarrivedId;
                        const canBegin = !allStopsArrived && !load.startLocation;
                        return (
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
                                {canBegin && (
                                  <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => handleBeginLoad(load.id)}
                                    className="px-3 py-2 rounded-lg text-white text-xs font-medium bg-blue-600"
                                  >
                                    Begin Load
                                  </motion.button>
                                )}
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
                          <div className="flex items-center gap-2">
                            <span className="text-white/80 text-xs">Stop {stopIndex + 1}</span>
                            {stop.arrivedAt && (
                              <span className="text-green-400 text-xs">Arrived</span>
                            )}
                          </div>
                          {!trip.isFinished && (
                            <div className="flex items-center gap-2">
                              {!stop.arrivedAt ? (
                                <>
                                  {firstUnarrivedId === stop.id && (
                                    <motion.button
                                      whileTap={{ scale: 0.95 }}
                                      onClick={() => handleDepartToStop(load.id, stop.id)}
                                      className="px-2.5 py-1.5 rounded-lg text-white text-xs font-medium bg-blue-600"
                                    >
                                      Depart to stop
                                    </motion.button>
                                  )}
                                  <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => handleArriveStop(load.id, stop.id)}
                                    className="px-2.5 py-1.5 rounded-lg text-white text-xs font-medium bg-blue-600"
                                  >
                                    Arrived
                                  </motion.button>
                                </>
                              ) : (
                                <motion.button
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => handleDeleteStop(load.id, stop.id)}
                                  className="text-red-400 text-xs"
                                >
                                  ×
                                </motion.button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                          {!trip.isFinished && allStopsArrived && !load.finishedAt && (
                            <div className="mt-2">
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleDepartToDC(load.id)}
                                className="w-full rounded-xl px-3 py-2.5 text-white text-sm font-medium bg-blue-600"
                              >
                                Head Back to DC
                              </motion.button>
                            </div>
                          )}
                </div>
                        );
              })}
            </div>
          )}
          </>
          )}

          {screen === 'load-detail' && openedLoadId && (() => {
            const load = trip.loads.find(l => l.id === openedLoadId)!;
            const firstUnarrivedId = getFirstUnarrivedStopId(load);
            const allStopsArrived = !firstUnarrivedId;
            const canBegin = !allStopsArrived && !load.startLocation;
            return (
              <div className="px-4 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { setScreen('loads'); playClick(); }}
                    className="w-10 h-10 glass rounded-xl flex items-center justify-center text-white/90"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </motion.button>
                  <h3 className="text-base font-semibold text-white">Load {trip.loads.findIndex(l => l.id === openedLoadId) + 1}</h3>
                  <div className="w-10" />
                </div>
                {canBegin && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { handleBeginLoad(load.id); playClick(); }}
                    className="w-full rounded-xl px-3 py-3 text-white text-sm font-medium bg-blue-600 mb-2"
                  >
                    Begin Load
                  </motion.button>
                )}
                <div className="space-y-2">
                  {load.stops.map((stop, i) => {
                    const isActive = firstUnarrivedId === stop.id && !stop.arrivedAt;
                    const isUpcoming = !stop.arrivedAt && !isActive;
                    return (
                      <div key={stop.id} className={`relative glass rounded-xl px-3 py-3 flex items-center justify-between ${isUpcoming ? 'opacity-60' : ''}`}>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs ${isActive ? 'text-blue-300' : 'text-white/80'}`}>Stop {i + 1}</span>
                          {stop.arrivedAt && <span className="text-green-400 text-xs">Arrived</span>}
                          {isActive && <span className="text-blue-400 text-xs">Active</span>}
                        </div>
                        {isActive && (
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => { handleDepartToStop(load.id, stop.id); setActiveLoadId(load.id); setActiveStopId(stop.id); setShowStopTracker(true); playClick(); }}
                            className="px-3 py-2 rounded-lg text-white text-xs font-medium bg-blue-600"
                          >
                            Depart To Stop
                          </motion.button>
                        )}
                        {isUpcoming && (
                          <span className="absolute inset-0 grid place-items-center text-white/60 text-[11px]">Upcoming Stop</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {!trip.isFinished && allStopsArrived && !load.finishedAt && (
                  <div className="mt-3">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => { handleDepartToDC(load.id); setActiveLoadId(load.id); setActiveStopId('dc'); setShowStopTracker(true); playClick(); }}
                      className="w-full rounded-xl px-3 py-3 text-white text-sm font-medium bg-blue-600"
                    >
                      Head Back To DC
                    </motion.button>
                  </div>
                )}
              </div>
            );
          })()}

        </div>
      </div>

      {/* Bottom Sheet Modals */}
      <AnimatePresence>
        {showStopTracker && settings && trip && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-50 safe-bottom"
            onClick={() => {}}
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
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-bold text-white">
                  Stop Tracker
                </h2>
                <div className="text-white/70 text-sm">
                  {isInNightWindow(new Date(), settings!) ? '🌙 Night' : '☀️ Day'}
                </div>
              </div>
              <div className="glass rounded-2xl p-4 mb-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-white/60 text-xs mb-1">Segment Miles</p>
                    <p className="text-xl font-bold text-white">{trackingMilesBuffer.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs mb-1">Trip Miles</p>
                    <p className="text-xl font-bold text-white">{(trip!.currentMileage - trip!.startMileage + trackingMilesBuffer).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs mb-1">Segment Night Miles</p>
                    <p className="text-xl font-bold text-white">{trackingNightMilesBuffer.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs mb-1">Night CPM</p>
                    <p className="text-xl font-bold text-white">
                      {settings.nightPayEnabled ? `$${(settings.cpm + (settings.nightExtraCpm || 0)).toFixed(2)}` : `$${settings.cpm.toFixed(2)}`}
                    </p>
                  </div>
                </div>
              </div>
              <div className="glass rounded-2xl p-4 mb-4">
                <p className="text-white/60 text-xs mb-1">Projected Total Pay</p>
                <div className="text-3xl font-bold text-white">
                  {formatCurrency(
                    calculateTripPay(
                      (trip!.currentMileage + trackingMilesBuffer) - trip!.startMileage,
                      trip!.loads,
                      settings!,
                      (trip!.nightMiles || 0) + trackingNightMilesBuffer
                    )
                  )}
                </div>
              </div>
              <div className="flex gap-3">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    // Arrive at current target (stop or DC)
                    if (activeStopId === 'dc') {
                      handleArriveDc();
                    } else if (activeLoadId && activeStopId) {
                      handleArriveStop(activeLoadId, activeStopId);
                    }
                    setShowStopTracker(false);
                  }}
                  className="flex-1 rounded-xl text-white font-medium py-3.5 bg-red-600 disabled:opacity-50"
                  disabled={updating}
                >
                  {activeStopId === 'dc' ? 'Arrived at DC' : 'Arrive at stop'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {showArrivedOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="glass rounded-3xl px-8 py-10 text-center"
            >
              <div className="text-4xl mb-3">✅</div>
              <div className="text-white text-xl font-bold mb-1">
                {showArrivedOverlay!.type === 'dc' ? 'Arrived at DC!' : `Arrived at stop ${(((showArrivedOverlay!.stopIndex || 0) + 1))}!`}
              </div>
              <div className="text-white/70 text-sm">Great job. Updating your load...</div>
            </motion.div>
          </motion.div>
        )}
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

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { getTrip, updateTrip, getSettings, Trip, Settings, Load, Stop } from '@/lib/db';
import { calculateTripPay, formatCurrency, formatDateTime, isInNightWindow, haversineMiles } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Timestamp } from 'firebase/firestore';
import { hapticLight, hapticMedium, hapticSuccess, hapticError } from '@/lib/haptics';
import { initSounds, playClick, playArrive } from '@/lib/sounds';
import FullScreenTracker from '@/components/tracking/FullScreenTracker';
import ArrivalOverlay from '@/components/ui/ArrivalOverlay';
import LoadStopsScreen from '@/components/loads/LoadStopsScreen';
import { requestGeoPermission } from '@/lib/permissions';

interface TripPageProps {
  tripId: string;
  onFinishTrip: () => void;
}

const TRACKING_STORAGE_KEY = 'ntransit-tracking-state-v1';

type PersistedTrackingState = {
  tripId: string;
  activeLoadId: string | null;
  activeStopId: string | null;
  trackingMilesBuffer: number;
  trackingNightMilesBuffer: number;
  lastCoords?: { lat: number; lng: number } | null;
  updatedAt: number;
};

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

  const trackingStateRef = useRef<PersistedTrackingState | null>(null);
  const trackingSnapshotRef = useRef<PersistedTrackingState | null>(null);
  const restoredTrackingRef = useRef(false);
  const settingsRef = useRef<Settings | null>(null);
  const activeTargetRef = useRef<{ loadId: string | null; stopId: string | null }>({ loadId: null, stopId: null });
  const tripIdRef = useRef<string | null>(null);

  const readPersistedTrackingState = useCallback((): PersistedTrackingState | null => {
    if (typeof window === 'undefined') return null;
    if (trackingStateRef.current) return trackingStateRef.current;
    const raw = window.localStorage.getItem(TRACKING_STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as PersistedTrackingState;
      trackingStateRef.current = parsed;
      return parsed;
    } catch {
      return null;
    }
  }, []);

  const writePersistedTrackingState = useCallback((state: PersistedTrackingState | null) => {
    if (typeof window === 'undefined') return;
    trackingStateRef.current = state;
    if (!state) {
      window.localStorage.removeItem(TRACKING_STORAGE_KEY);
    } else {
      window.localStorage.setItem(TRACKING_STORAGE_KEY, JSON.stringify(state));
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadTrip();
    }
  }, [user, tripId]);

  useEffect(() => {
    initSounds();
  }, []);

  useEffect(() => {
    restoredTrackingRef.current = false;
  }, [tripId]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    activeTargetRef.current = { loadId: activeLoadId, stopId: activeStopId };
  }, [activeLoadId, activeStopId]);

  useEffect(() => {
    tripIdRef.current = trip?.id ?? null;
  }, [trip?.id]);

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

  const startTracking = useCallback(() => {
    if (watchId !== null) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!activeTargetRef.current.loadId) {
          setLastCoords(coords);
          return;
        }
        setLastCoords((prev) => {
          if (prev) {
            const delta = haversineMiles(prev, coords);
            if (delta > 0) {
              setTrackingMilesBuffer((m) => m + delta);
              const activeSettings = settingsRef.current;
              if (activeSettings && isInNightWindow(new Date(), activeSettings)) {
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
  }, [watchId]);

  const stopTracking = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setLastCoords(null);
  };

  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  useEffect(() => {
    if (!trip || !activeLoadId) return;
    const snapshot: PersistedTrackingState = {
      tripId: trip.id,
      activeLoadId,
      activeStopId,
      trackingMilesBuffer,
      trackingNightMilesBuffer,
      lastCoords,
      updatedAt: Date.now(),
    };
    trackingSnapshotRef.current = snapshot;
    writePersistedTrackingState(snapshot);
  }, [
    trip?.id,
    activeLoadId,
    activeStopId,
    trackingMilesBuffer,
    trackingNightMilesBuffer,
    lastCoords,
    writePersistedTrackingState,
  ]);

  useEffect(() => {
    if (!activeLoadId) {
      trackingSnapshotRef.current = null;
      writePersistedTrackingState(null);
    }
  }, [activeLoadId, writePersistedTrackingState]);

  useEffect(() => {
    if (!trip || !settings || restoredTrackingRef.current) return;
    const stored = readPersistedTrackingState();
    if (stored && stored.tripId === trip.id && stored.activeLoadId) {
      activeTargetRef.current = { loadId: stored.activeLoadId, stopId: stored.activeStopId || null };
      setActiveLoadId(stored.activeLoadId);
      setActiveStopId(stored.activeStopId || null);
      setTrackingMilesBuffer(stored.trackingMilesBuffer || 0);
      setTrackingNightMilesBuffer(stored.trackingNightMilesBuffer || 0);
      if (stored.lastCoords) {
        setLastCoords(stored.lastCoords);
      }
      setShowStopTracker(true);
      trackingSnapshotRef.current = stored;
      startTracking();
      restoredTrackingRef.current = true;
      return;
    }
    if (trip.trackingActive && trip.trackingLoadId) {
      activeTargetRef.current = { loadId: trip.trackingLoadId, stopId: trip.trackingStopId || null };
      setActiveLoadId(trip.trackingLoadId);
      setActiveStopId(trip.trackingStopId || null);
      setTrackingMilesBuffer(trip.trackingMilesBuffer || 0);
      setTrackingNightMilesBuffer(trip.trackingNightMilesBuffer || 0);
      if (trip.trackingLastLocation) {
        setLastCoords(trip.trackingLastLocation);
      }
      setShowStopTracker(true);
      const snapshot: PersistedTrackingState = {
        tripId: trip.id,
        activeLoadId: trip.trackingLoadId,
        activeStopId: trip.trackingStopId || null,
        trackingMilesBuffer: trip.trackingMilesBuffer || 0,
        trackingNightMilesBuffer: trip.trackingNightMilesBuffer || 0,
        lastCoords: trip.trackingLastLocation || null,
        updatedAt: Date.now(),
      };
      trackingSnapshotRef.current = snapshot;
      writePersistedTrackingState(snapshot);
      startTracking();
    }
    restoredTrackingRef.current = true;
  }, [trip, settings, readPersistedTrackingState, writePersistedTrackingState, startTracking]);

  useEffect(() => {
    if (!trip) return;
    const interval = setInterval(() => {
      const snapshot = trackingSnapshotRef.current;
      if (!snapshot || !snapshot.activeLoadId) return;
      const currentTripId = tripIdRef.current;
      if (!currentTripId) return;
      updateTrip(currentTripId, {
        trackingActive: true,
        trackingMilesBuffer: snapshot.trackingMilesBuffer,
        trackingNightMilesBuffer: snapshot.trackingNightMilesBuffer,
        trackingLastLocation: snapshot.lastCoords || null,
        trackingLoadId: snapshot.activeLoadId,
        trackingStopId: snapshot.activeStopId || null,
      })
        .then(() => {
          setTrip((prev) =>
            prev
              ? {
                  ...prev,
                  trackingActive: true,
                  trackingMilesBuffer: snapshot.trackingMilesBuffer,
                  trackingNightMilesBuffer: snapshot.trackingNightMilesBuffer,
                  trackingLastLocation: snapshot.lastCoords || null,
                  trackingLoadId: snapshot.activeLoadId,
                  trackingStopId: snapshot.activeStopId || null,
                }
              : prev
          );
        })
        .catch((error) => console.error('Error syncing tracking state:', error));
    }, 10000);
    return () => clearInterval(interval);
  }, [trip?.id]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible' || !activeTargetRef.current.loadId) {
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setLastCoords((prev) => {
            if (prev) {
              const delta = haversineMiles(prev, coords);
              if (delta > 0) {
                setTrackingMilesBuffer((m) => m + delta);
                const activeSettings = settingsRef.current;
                if (activeSettings && isInNightWindow(new Date(), activeSettings)) {
                  setTrackingNightMilesBuffer((m) => m + delta);
                }
              }
            }
            return coords;
          });
        },
        (err) => {
          console.error('Visibility geolocation error:', err);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

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
      const pos = await requestGeoPermission();
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setLastCoords(coords);
      setTrackingMilesBuffer(0);
      setTrackingNightMilesBuffer(0);
      activeTargetRef.current = { loadId, stopId };
      setActiveLoadId(loadId);
      setActiveStopId(stopId);
      setShowStopTracker(true);
      startTracking();

      const trackingPayload: Partial<Trip> = {
        trackingActive: true,
        trackingLastLocation: coords,
        trackingMilesBuffer: 0,
        trackingNightMilesBuffer: 0,
        trackingLoadId: loadId,
        trackingStopId: stopId,
      };

      await updateTrip(trip.id, trackingPayload);
      setTrip((prev) => (prev ? { ...prev, ...trackingPayload } : prev));

      const snapshot: PersistedTrackingState = {
        tripId: trip.id,
        activeLoadId: loadId,
        activeStopId: stopId,
        trackingMilesBuffer: 0,
        trackingNightMilesBuffer: 0,
        lastCoords: coords,
        updatedAt: Date.now(),
      };
      trackingSnapshotRef.current = snapshot;
      writePersistedTrackingState(snapshot);
    } catch (error) {
      console.error('Failed to start tracking to stop:', error);
      alert('Location permission is required to start tracking.');
    }
  };

  const handleDepartToDC = async (loadId: string) => {
    if (!trip) return;
    try {
      const pos = await requestGeoPermission();
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setLastCoords(coords);
      setTrackingMilesBuffer(0);
      setTrackingNightMilesBuffer(0);
      activeTargetRef.current = { loadId, stopId: 'dc' };
      setActiveLoadId(loadId);
      setActiveStopId('dc');
      startTracking();
      setShowStopTracker(true);

      const trackingPayload: Partial<Trip> = {
        trackingActive: true,
        trackingLastLocation: coords,
        trackingMilesBuffer: 0,
        trackingNightMilesBuffer: 0,
        trackingLoadId: loadId,
        trackingStopId: 'dc',
      };

      await updateTrip(trip.id, trackingPayload);
      setTrip((prev) => (prev ? { ...prev, ...trackingPayload } : prev));

      const snapshot: PersistedTrackingState = {
        tripId: trip.id,
        activeLoadId: loadId,
        activeStopId: 'dc',
        trackingMilesBuffer: 0,
        trackingNightMilesBuffer: 0,
        lastCoords: coords,
        updatedAt: Date.now(),
      };
      trackingSnapshotRef.current = snapshot;
      writePersistedTrackingState(snapshot);
    } catch (error) {
      console.error('Failed to start tracking to DC:', error);
      alert('Location permission is required to start tracking.');
    }
  };

  const handleArriveDc = async () => {
    if (!trip || !settings || !activeLoadId) return;
    setUpdating(true);
    try {
      stopTracking();
      const pos = await requestGeoPermission();
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
        trackingActive: false,
        trackingMilesBuffer: 0,
        trackingNightMilesBuffer: 0,
        trackingLastLocation: null,
        trackingLoadId: null,
        trackingStopId: null,
      });
      setTrip((prev) =>
        prev
          ? {
              ...prev,
              loads: updatedLoads,
              currentMileage: newCurrentMileage,
              nightMiles: newNightMiles,
              totalPay,
              trackingActive: false,
              trackingMilesBuffer: 0,
              trackingNightMilesBuffer: 0,
              trackingLastLocation: null,
              trackingLoadId: null,
              trackingStopId: null,
            }
          : prev
      );
      setTrackingMilesBuffer(0);
      setTrackingNightMilesBuffer(0);
      setShowStopTracker(false);
      activeTargetRef.current = { loadId: null, stopId: null };
      setActiveLoadId(null);
      setActiveStopId(null);
      trackingSnapshotRef.current = null;
      writePersistedTrackingState(null);
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
      const pos = await requestGeoPermission();
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
        trackingLastLocation: null,
        trackingLoadId: null,
        trackingStopId: null,
      });
      setTrip((prev) =>
        prev
          ? {
              ...prev,
              loads: updatedLoads,
              currentMileage: newCurrentMileage,
              nightMiles: newNightMiles,
              totalPay,
              trackingActive: false,
              trackingMilesBuffer: 0,
              trackingNightMilesBuffer: 0,
              trackingLastLocation: null,
              trackingLoadId: null,
              trackingStopId: null,
            }
          : prev
      );
      setTrackingMilesBuffer(0);
      setTrackingNightMilesBuffer(0);
      setShowStopTracker(false);
      activeTargetRef.current = { loadId: null, stopId: null };
      setActiveLoadId(null);
      setActiveStopId(null);
      trackingSnapshotRef.current = null;
      writePersistedTrackingState(null);
      hapticSuccess();
      playArrive();
      setShowArrivedOverlay({ type: 'stop' });
      setTimeout(() => setShowArrivedOverlay(null), 1500);
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
      playArrive();
      setShowArrivedOverlay({ type: 'dc' });
      setTimeout(() => setShowArrivedOverlay(null), 1500);
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
      setShowStopTracker(false);
      activeTargetRef.current = { loadId: null, stopId: null };
      setActiveLoadId(null);
      setActiveStopId(null);
      trackingSnapshotRef.current = null;
      writePersistedTrackingState(null);
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
        trackingActive: false,
        trackingMilesBuffer: 0,
        trackingNightMilesBuffer: 0,
        trackingLastLocation: null,
        trackingLoadId: null,
        trackingStopId: null,
      });
      setTrackingMilesBuffer(0);
      setTrackingNightMilesBuffer(0);
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
      <div className="h-full flex items-center justify-center ntransit-shell">
        <div className="text-white/60 tracking-[0.3em] uppercase text-xs">Loading</div>
      </div>
    );
  }

  const mileage = trip.currentMileage - trip.startMileage;
  const formatMiles = (n: number) => Number.isFinite(n) ? (Math.floor(n * 100) / 100).toFixed(2) : '0.00';

  return (
    <div className="h-full flex flex-col ntransit-shell text-white">
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
                <p className="text-sm font-bold text-white">{formatMiles(mileage)}</p>
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
                const completed = !!load.finishedAt;
                return (
                  <motion.div
                    key={load.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { playClick(); setOpenedLoadId(load.id); setScreen('load-detail'); }}
                    className={`rounded-2xl p-4 border ${completed ? 'border-green-500/30 bg-green-500/10' : 'border-white/10 bg-white/5'} active:opacity-80`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-white">Load {index + 1}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${load.loadType === 'wet' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                          {load.loadType === 'wet' ? '💧' : '📦'}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-white/90">
                          {load.stops.length} stops
                        </span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${completed ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                        {completed ? 'Complete' : firstUnarrivedId ? 'In Progress' : 'Ready'}
                      </span>
                    </div>
                  </motion.div>
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
              <LoadStopsScreen
                load={load}
                loadIndex={trip.loads.findIndex(l => l.id === openedLoadId)}
                getFirstUnarrivedStopId={getFirstUnarrivedStopId}
                onBack={() => { setScreen('loads'); }}
                onDepartToStop={(stopId) => { handleDepartToStop(load.id, stopId); setActiveLoadId(load.id); setActiveStopId(stopId); setShowStopTracker(true); }}
                onDepartToDC={() => { handleDepartToDC(load.id); setActiveLoadId(load.id); setActiveStopId('dc'); setShowStopTracker(true); }}
              />
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
              className="fixed inset-0 bg-[#01060f]/90 backdrop-blur-2xl z-50 safe-bottom"
            onClick={() => {}}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
                className="absolute bottom-0 left-0 right-0 glass rounded-t-[32px] p-6 border border-white/5"
            >
              <div className="w-12 h-1 bg-white/30 rounded-full mx-auto mb-6" />
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-white/40">Segment</p>
                    <h2 className="text-2xl font-semibold text-white">
                      Stop Tracker
                    </h2>
                </div>
                  <div className="text-white/70 text-sm border border-white/10 rounded-full px-3 py-1 flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-cyan-300 animate-pulse" />
                    {isInNightWindow(new Date(), settings!) ? 'Night Window' : 'Day Window'}
                  </div>
              </div>
                <div className="glass rounded-2xl p-4 mb-3 border border-white/5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                      <p className="text-white/60 text-xs uppercase tracking-[0.2em] mb-1">Segment Miles</p>
                      <p className="text-2xl font-semibold text-white">{trackingMilesBuffer.toFixed(2)}</p>
                  </div>
                  <div>
                      <p className="text-white/60 text-xs uppercase tracking-[0.2em] mb-1">Trip Miles</p>
                      <p className="text-2xl font-semibold text-white">{(trip!.currentMileage - trip!.startMileage + trackingMilesBuffer).toFixed(2)}</p>
                  </div>
                  <div>
                      <p className="text-white/60 text-xs uppercase tracking-[0.2em] mb-1">Night Segment</p>
                      <p className="text-2xl font-semibold text-white">{trackingNightMilesBuffer.toFixed(2)}</p>
                  </div>
                  <div>
                      <p className="text-white/60 text-xs uppercase tracking-[0.2em] mb-1">Night CPM</p>
                      <p className="text-2xl font-semibold text-white">
                      {settings.nightPayEnabled ? `$${(settings.cpm + (settings.nightExtraCpm || 0)).toFixed(2)}` : `$${settings.cpm.toFixed(2)}`}
                    </p>
                  </div>
                </div>
              </div>
                <div className="glass rounded-2xl p-4 mb-4 border border-white/5">
                  <p className="text-white/60 text-xs uppercase tracking-[0.3em] mb-1">Projected Total Pay</p>
                  <div className="text-3xl font-semibold text-white">
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
                    className="flex-1 rounded-2xl ntransit-cta text-black/80 font-semibold py-3.5 disabled:opacity-50"
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

import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  getDocs, 
  Timestamp,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';

export interface Settings {
  cpm: number; // dollars per mile (e.g., 1.00 for $1.00 per mile)
  payPerLoad: number;
  payPerStop: number;
  // Nightly pay configuration
  nightPayEnabled?: boolean; // default false
  nightStartMinutes?: number; // minutes since midnight (0-1439), e.g., 19:00 -> 1140
  nightEndMinutes?: number; // minutes since midnight (0-1439), can be less than start to indicate overnight window
  nightExtraCpm?: number; // dollars per mile extra during night (e.g., 0.06)
}

export interface GeoPointLite {
  lat: number;
  lng: number;
}

export interface Stop {
  id: string;
  name?: string;
  arrivedAt?: Timestamp;
  arrivedLocation?: GeoPointLite;
}

export interface Load {
  id: string;
  stops: Stop[];
  loadType: 'wet' | 'dry';
  createdAt: Timestamp;
  startLocation?: GeoPointLite;
  finishedAt?: Timestamp;
  finishedLocation?: GeoPointLite;
}

export interface Trip {
  id: string;
  userId: string;
  startMileage: number;
  currentMileage: number;
  endMileage?: number;
  loads: Load[];
  totalPay: number;
  isFinished: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  finishedAt?: Timestamp;
  // Mileage driven during configured nightly window
  nightMiles?: number;
  // Live tracking (segment) state - optional, for accuracy and resilience
  trackingActive?: boolean;
  trackingMilesBuffer?: number;
  trackingNightMilesBuffer?: number;
  trackingLastLocation?: GeoPointLite;
}

// Settings
export async function getSettings(userId: string): Promise<Settings | null> {
  if (!db) {
    throw new Error('Firestore database is not initialized.');
  }
  const docRef = doc(db, 'settings', userId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data() as Settings;
  }
  return null;
}

export async function saveSettings(userId: string, settings: Settings): Promise<void> {
  if (!db) {
    throw new Error('Firestore database is not initialized.');
  }
  const docRef = doc(db, 'settings', userId);
  await setDoc(docRef, settings);
}

// Trips
export async function getTrips(userId: string): Promise<Trip[]> {
  if (!db) {
    throw new Error('Firestore database is not initialized.');
  }
  const q = query(collection(db, 'trips'), where('userId', '==', userId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Trip));
}

export async function createTrip(userId: string, startMileage: number): Promise<string> {
  if (!db) {
    throw new Error('Firestore database is not initialized. Make sure you are running this on the client side.');
  }
  const tripsRef = collection(db, 'trips');
  const newTrip = {
    userId,
    startMileage,
    currentMileage: startMileage,
    nightMiles: 0,
    loads: [],
    totalPay: 0,
    isFinished: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const docRef = await addDoc(tripsRef, newTrip);
  return docRef.id;
}

export async function getTrip(tripId: string): Promise<Trip | null> {
  if (!db) {
    throw new Error('Firestore database is not initialized.');
  }
  const docRef = doc(db, 'trips', tripId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Trip;
  }
  return null;
}

export async function updateTrip(tripId: string, updates: Partial<Trip>): Promise<void> {
  if (!db) {
    throw new Error('Firestore database is not initialized.');
  }
  const docRef = doc(db, 'trips', tripId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTrip(tripId: string): Promise<void> {
  if (!db) {
    throw new Error('Firestore database is not initialized.');
  }
  const docRef = doc(db, 'trips', tripId);
  await deleteDoc(docRef);
}


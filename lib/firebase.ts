import { initializeApp, getApps, FirebaseApp, FirebaseOptions } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

type FirebaseConfigShape = Partial<Record<keyof FirebaseOptions, string>>;

const isNonEmptyString = (value?: string | null): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const normalizeConfig = (config?: FirebaseConfigShape | null): FirebaseOptions | null => {
  if (!config) return null;

  const requiredConfigKeys: Array<keyof FirebaseOptions> = ['apiKey', 'authDomain', 'projectId', 'appId'];
  const hasAllRequiredKeys = requiredConfigKeys.every((key) => isNonEmptyString(config[key]));

  if (!hasAllRequiredKeys) {
    return null;
  }

  const normalized: FirebaseOptions = {
    apiKey: config.apiKey!.trim(),
    authDomain: config.authDomain!.trim(),
    projectId: config.projectId!.trim(),
    appId: config.appId!.trim(),
  };

  const optionalKeys: Array<keyof FirebaseOptions> = ['storageBucket', 'messagingSenderId', 'measurementId', 'databaseURL'];
  optionalKeys.forEach((key) => {
    if (isNonEmptyString(config[key])) {
      normalized[key] = config[key]!.trim();
    }
  });

  return normalized;
};

const envFirebaseConfig: FirebaseConfigShape = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

const getRuntimeConfig = (): FirebaseConfigShape | undefined => {
  if (typeof window === 'undefined') return undefined;
  return window.__FIREBASE_CONFIG__;
};

const getFirebaseConfig = (): FirebaseOptions | null => {
  const normalizedEnvConfig = normalizeConfig(envFirebaseConfig);
  if (normalizedEnvConfig) return normalizedEnvConfig;
  
  const runtimeConfig = getRuntimeConfig();
  const normalizedRuntimeConfig = normalizeConfig(runtimeConfig);
  return normalizedRuntimeConfig;
};

const requiredConfigKeys: Array<keyof FirebaseOptions> = ['apiKey', 'authDomain', 'projectId', 'appId'];
const missingEnvKeys = requiredConfigKeys.filter((key) => !isNonEmptyString(envFirebaseConfig[key]));

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let isInitialized = false;

const initializeFirebase = (): boolean => {
  // If already successfully initialized, don't reinitialize
  if (isInitialized && auth) {
    return true;
  }

  const firebaseConfig = getFirebaseConfig();
  const hasValidFirebaseConfig = Boolean(firebaseConfig);

  if (typeof window !== 'undefined' && hasValidFirebaseConfig && firebaseConfig) {
    try {
      if (!getApps().length) {
        app = initializeApp(firebaseConfig);
      } else {
        app = getApps()[0];
      }
      auth = getAuth(app);
      db = getFirestore(app);
      isInitialized = true;
      console.log('Firebase initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Firebase:', error);
      return false;
    }
  } else if (typeof window !== 'undefined' && !hasValidFirebaseConfig) {
    // Don't log warning on every attempt, only if we've waited a bit
    return false;
  }
  return false;
};

// Initialize immediately if config is available (from env vars)
if (typeof window !== 'undefined') {
  const envConfig = normalizeConfig(envFirebaseConfig);
  if (envConfig) {
    initializeFirebase();
  } else {
    // Wait for runtime config script to load
    const tryInit = () => {
      if (!isInitialized) {
        const success = initializeFirebase();
        if (success) {
          // Dispatch event to notify that Firebase is ready
          window.dispatchEvent(new Event('firebase-initialized'));
        }
      }
    };

    // Listen for config loaded event (if we add it back)
    window.addEventListener('firebase-config-loaded', tryInit);

    // Try multiple times to catch the script loading
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(tryInit, 100);
        setTimeout(tryInit, 500);
        setTimeout(tryInit, 1000);
        setTimeout(tryInit, 2000);
      });
    } else {
      // DOM already loaded, check immediately and retry if needed
      setTimeout(tryInit, 100);
      setTimeout(tryInit, 500);
      setTimeout(tryInit, 1000);
      setTimeout(tryInit, 2000);
      setTimeout(tryInit, 3000);
    }
  }
}

export { auth, db, initializeFirebase };
export default app;
export const isFirebaseConfigured = (): boolean => {
  if (typeof window === 'undefined') return false;
  const config = getFirebaseConfig();
  return Boolean(config);
};

declare global {
  interface Window {
    __FIREBASE_CONFIG__?: FirebaseConfigShape;
  }
}


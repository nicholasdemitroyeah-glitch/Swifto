'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from './firebase';
import { initializeFirebase } from './firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    let unsubscribe: (() => void) | null = null;
    let pollInterval: NodeJS.Timeout | null = null;

    // Function to set up auth listener
    const setupAuthListener = (): boolean => {
      if (!auth) {
        return false; // Not ready yet
      }

      try {
        unsubscribe = onAuthStateChanged(
          auth,
          (currentUser) => {
            setUser(currentUser);
            setAuthError(null);
            setLoading(false);
          },
          (error) => {
            console.error('Auth state error:', error);
            setAuthError(error.message);
            setLoading(false);
          }
        );
        return true; // Successfully set up
      } catch (error) {
        console.error('Failed to initialize auth listener:', error);
        setAuthError(error instanceof Error ? error.message : 'Unable to initialize authentication.');
        setLoading(false);
        return false;
      }
    };

    // Try to initialize Firebase if not already initialized
    if (!auth) {
      initializeFirebase();
    }

    // Try to set up listener immediately
    if (setupAuthListener()) {
      // Successfully set up, return cleanup
      return () => {
        if (unsubscribe) unsubscribe();
      };
    }

    // Listen for Firebase initialization event
    const handleFirebaseInitialized = () => {
      if (!auth) {
        initializeFirebase();
      }
      if (auth && setupAuthListener()) {
        if (pollInterval) clearInterval(pollInterval);
      }
    };
    window.addEventListener('firebase-initialized', handleFirebaseInitialized);
    window.addEventListener('firebase-config-loaded', handleFirebaseInitialized);

    // Auth not ready yet, poll for it
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds total - give more time for script to load
    pollInterval = setInterval(() => {
      attempts++;
      if (!auth) {
        initializeFirebase();
      }
      if (auth && setupAuthListener()) {
        if (pollInterval) clearInterval(pollInterval);
      } else if (attempts >= maxAttempts) {
        if (pollInterval) clearInterval(pollInterval);
        if (!isFirebaseConfigured()) {
          setAuthError('Firebase is not configured. Set the NEXT_PUBLIC_FIREBASE_* environment variables to enable sign-in.');
        } else {
          setAuthError('Authentication is temporarily unavailable. Please refresh the page.');
        }
        setLoading(false);
      }
    }, 100);

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      window.removeEventListener('firebase-initialized', handleFirebaseInitialized);
      window.removeEventListener('firebase-config-loaded', handleFirebaseInitialized);
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    // Try to initialize if not already done
    if (!auth && typeof window !== 'undefined') {
      initializeFirebase();
      // Wait a moment for initialization
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    if (!auth) {
      const message =
        authError ??
        (isFirebaseConfigured()
          ? 'Authentication is temporarily unavailable.'
          : 'Firebase is not configured. Add the NEXT_PUBLIC_FIREBASE_* environment variables to enable sign-in.');
      throw new Error(message);
    }
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      setAuthError(null);
    } catch (error) {
      console.error('Google sign-in failed:', error);
      const message = error instanceof Error ? error.message : 'Failed to sign in with Google.';
      setAuthError(message);
      throw error;
    }
  };

  const signOut = async () => {
    if (!auth) {
      setAuthError('Cannot sign out because authentication is not initialized.');
      return;
    }
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, authError, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}


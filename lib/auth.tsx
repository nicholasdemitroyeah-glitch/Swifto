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
    if (!auth) {
      if (!isFirebaseConfigured) {
        setAuthError('Firebase is not configured. Set the NEXT_PUBLIC_FIREBASE_* environment variables to enable sign-in.');
      } else {
        setAuthError('Authentication is unavailable in this environment.');
      }
      setLoading(false);
      return;
    }

    try {
      const unsubscribe = onAuthStateChanged(
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

      return () => unsubscribe();
    } catch (error) {
      console.error('Failed to initialize auth listener:', error);
      setAuthError(error instanceof Error ? error.message : 'Unable to initialize authentication.');
      setLoading(false);
    }
  }, []);

  const signInWithGoogle = async () => {
    if (!auth) {
      const message =
        authError ??
        (isFirebaseConfigured
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


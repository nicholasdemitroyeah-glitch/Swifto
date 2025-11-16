'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { isFirebaseConfigured } from '@/lib/firebase';
import { hapticMedium } from '@/lib/haptics';

export default function LoginPage() {
  const { signInWithGoogle, authError } = useAuth();
  const [localError, setLocalError] = useState<string | null>(null);
  const [configAvailable, setConfigAvailable] = useState(false);
  const combinedError = localError || authError;
  
  // Check for config availability reactively
  useEffect(() => {
    const checkConfig = () => {
      setConfigAvailable(isFirebaseConfigured());
    };
    
    checkConfig();
    const interval = setInterval(checkConfig, 500);
    
    // Also listen for config loaded
    window.addEventListener('firebase-config-loaded', checkConfig);
    window.addEventListener('firebase-initialized', checkConfig);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('firebase-config-loaded', checkConfig);
      window.removeEventListener('firebase-initialized', checkConfig);
    };
  }, []);
  
  const signInDisabled = !configAvailable;

  const handleSignIn = async () => {
    if (signInDisabled) {
      console.log('Sign in disabled, config available:', isFirebaseConfigured());
      return;
    }
    hapticMedium();
    setLocalError(null);
    try {
      console.log('Attempting sign in...');
      await signInWithGoogle();
      console.log('Sign in successful');
    } catch (error) {
      console.error('Sign in error:', error);
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to sign in right now. Please try again.';
      setLocalError(message);
    }
  };

  return (
    <div className="h-full ntransit-shell flex items-center justify-center p-6 safe-top safe-bottom">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md space-y-10"
      >
        <div className="text-center space-y-5">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="uppercase tracking-[0.45em] text-cyan-200/70 text-xs font-semibold"
            style={{ fontFamily: 'Orbitron, sans-serif' }}
          >
            N·Transit Ops
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="text-4xl font-semibold text-white"
          >
            Fleet Intelligence Console
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="text-white/70 text-sm leading-relaxed px-4"
          >
            A dark, data-forward interface inspired by Walmart&apos;s N-Transit
            platform for tracking live loads, mileage, and pay calculations
            without losing state in the field.
          </motion.p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="ntransit-chip">Live miles</span>
            <span className="ntransit-chip">Stop tracker</span>
            <span className="ntransit-chip">Night pay</span>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="glass rounded-3xl p-6 space-y-4 border border-white/5"
        >
          <div className="text-left">
            <div className="text-xs uppercase tracking-[0.35em] text-white/50 mb-2">
              Secure Access
            </div>
            <p className="text-white/80 text-sm">
              Sign in to sync every stop segment, projected pay, and mileage
              buffer in real time.
            </p>
          </div>
          <div className="flex items-center justify-center gap-1 text-[0.7rem] text-white/40">
            <span className="inline-block h-1 w-1 rounded-full bg-cyan-300/70 animate-pulse" />
            Federated identity managed by Google
          </div>
        </motion.div>

        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleSignIn}
          disabled={signInDisabled}
          className={`w-full ntransit-cta px-6 py-4 flex items-center justify-center gap-3 text-base ${
            signInDisabled ? 'opacity-40 cursor-not-allowed' : ''
          }`}
        >
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/20">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          </span>
          <span className="font-semibold tracking-wide">
            Continue with Google
          </span>
        </motion.button>

        {(combinedError || signInDisabled) && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="text-center text-sm text-red-200/80 bg-red-500/10 border border-red-300/20 rounded-2xl px-4 py-3"
          >
            {combinedError ??
              'Firebase credentials are not configured. Add the NEXT_PUBLIC_FIREBASE_* env vars and redeploy to enable sign-in.'}
          </motion.div>
        )}

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
          className="text-center text-xs text-white/40 px-6"
        >
          Your trip, load, and settings data stay encrypted in Firestore.
          Nothing is stored on this device beyond the resilient stop tracker
          buffer.
        </motion.p>
      </motion.div>
    </div>
  );
}

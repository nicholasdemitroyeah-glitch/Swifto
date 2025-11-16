'use client';

import { useEffect } from 'react';
import Script from 'next/script';

export default function FirebaseConfigLoader() {
  useEffect(() => {
    // This will run on the client side after the script loads
    const checkConfig = () => {
      if (typeof window !== 'undefined' && window.__FIREBASE_CONFIG__) {
        // Dispatch event to notify that config is loaded
        window.dispatchEvent(new Event('firebase-config-loaded'));
      }
    };

    // Check immediately in case script already loaded
    checkConfig();
    
    // Also check after a delay
    const timeout = setTimeout(checkConfig, 100);
    
    return () => clearTimeout(timeout);
  }, []);

  return (
    <Script
      src="/firebase-config.js"
      strategy="beforeInteractive"
      onLoad={() => {
        if (typeof window !== 'undefined' && window.__FIREBASE_CONFIG__) {
          window.dispatchEvent(new Event('firebase-config-loaded'));
        }
      }}
      onError={() => {
        console.warn('firebase-config.js not found. Using environment variables if available.');
      }}
    />
  );
}


'use client';

import { useEffect, useMemo } from 'react';
import Script from 'next/script';

export default function FirebaseConfigLoader() {
  const firebaseConfigSrc = useMemo(() => {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
    if (!basePath) return '/firebase-config.js';
    const sanitized = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
    return `${sanitized}/firebase-config.js`;
  }, []);

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
      src={firebaseConfigSrc}
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


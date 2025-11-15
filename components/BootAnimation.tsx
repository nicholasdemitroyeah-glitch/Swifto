'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface BootAnimationProps {
  onComplete: () => void;
}

export default function BootAnimation({ onComplete }: BootAnimationProps) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false);
      setTimeout(onComplete, 300);
    }, 1800);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
    >
      {/* Subtle animated gradient background */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/20 rounded-full blur-3xl"
        />
      </div>

      <div className="text-center relative z-10 px-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ 
            duration: 0.6, 
            ease: [0.16, 1, 0.3, 1] // Apple-like easing
          }}
        >
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="text-5xl sm:text-6xl font-bold text-white mb-3 tracking-tight"
            style={{ 
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
              fontWeight: 700,
              letterSpacing: '-0.02em'
            }}
          >
            Swift Will F*** You
          </motion.h1>
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: '60%', opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent mx-auto rounded-full"
          />
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 0.6, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="text-sm sm:text-base text-white/60 font-light mt-4 tracking-wide"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif' }}
          >
            Trip & Pay Calculator
          </motion.p>
        </motion.div>
      </div>
    </motion.div>
  );
}

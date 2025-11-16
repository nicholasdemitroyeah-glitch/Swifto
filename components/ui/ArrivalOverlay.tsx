'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface ArrivalOverlayProps {
  visible: boolean;
  message: string;
}

export default function ArrivalOverlay({ visible, message }: ArrivalOverlayProps) {
  return (
    <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-[#01060f]/85 backdrop-blur-2xl flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              className="glass rounded-[32px] px-10 py-12 text-center border border-white/10"
            >
              <div className="text-4xl mb-3">✅</div>
              <div className="text-white text-2xl font-semibold mb-1">{message}</div>
              <div className="text-white/70 text-sm tracking-[0.2em] uppercase">Updating load</div>
            </motion.div>
          </motion.div>
        )}
    </AnimatePresence>
  );
}



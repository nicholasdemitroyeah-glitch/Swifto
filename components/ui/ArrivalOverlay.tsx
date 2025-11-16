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
          className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 22 }}
            className="glass rounded-3xl px-10 py-12 text-center"
          >
            <div className="text-5xl mb-3">✅</div>
            <div className="text-white text-2xl font-extrabold mb-1">{message}</div>
            <div className="text-white/70 text-sm">Great job. Updating your load...</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}



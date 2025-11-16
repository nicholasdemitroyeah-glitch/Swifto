'use client';

import { motion } from 'framer-motion';
import { Settings } from '@/lib/db';
import { isInNightWindow, calculateTripPay, formatCurrency } from '@/lib/utils';

interface StopTrackerOverlayProps {
  visible: boolean;
  onArrive: () => void;
  onClose?: () => void;
  trackingMiles: number;
  trackingNightMiles: number;
  baseTripMiles: number;
  baseNightMiles: number;
  baseTotalPay: number;
  settings: Settings;
}

export default function StopTrackerOverlay({
  visible,
  onArrive,
  onClose,
  trackingMiles,
  trackingNightMiles,
  baseTripMiles,
  baseNightMiles,
  baseTotalPay,
  settings
}: StopTrackerOverlayProps) {
  if (!visible) return null;
  const projMiles = baseTripMiles + trackingMiles;
  const projNight = baseNightMiles + trackingNightMiles;
  const projPay = calculateTripPay(projMiles, [], settings, projNight) + (baseTotalPay - calculateTripPay(baseTripMiles, [], settings, baseNightMiles));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/90 z-50 safe-bottom"
      onClick={() => onClose?.()}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-0 left-0 right-0 glass rounded-t-3xl p-6"
      >
        <div className="w-12 h-1 bg-white/30 rounded-full mx-auto mb-6" />
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold text-white">Stop Tracker</h2>
          <div className="text-white/70 text-sm">
            {isInNightWindow(new Date(), settings) ? '🌙 Night' : '☀️ Day'}
          </div>
        </div>
        <div className="glass rounded-2xl p-4 mb-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-white/60 text-xs mb-1">Segment Miles</p>
              <p className="text-xl font-bold text-white">{trackingMiles.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-white/60 text-xs mb-1">Trip Miles</p>
              <p className="text-xl font-bold text-white">{projMiles.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-white/60 text-xs mb-1">Segment Night Miles</p>
              <p className="text-xl font-bold text-white">{trackingNightMiles.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-white/60 text-xs mb-1">Night CPM</p>
              <p className="text-xl font-bold text-white">
                {settings.nightPayEnabled ? `$${(settings.cpm + (settings.nightExtraCpm || 0)).toFixed(2)}` : `$${settings.cpm.toFixed(2)}`}
              </p>
            </div>
          </div>
        </div>
        <div className="glass rounded-2xl p-4 mb-4">
          <p className="text-white/60 text-xs mb-1">Projected Total Pay</p>
          <div className="text-3xl font-bold text-white">{formatCurrency(projPay)}</div>
        </div>
        <div className="flex gap-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onArrive}
            className="flex-1 rounded-xl text-white font-medium py-3.5 bg-red-600 disabled:opacity-50"
          >
            Arrive at stop
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}



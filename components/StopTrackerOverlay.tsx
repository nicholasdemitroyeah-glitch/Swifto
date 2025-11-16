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
      className="fixed inset-0 bg-[#01060f]/90 backdrop-blur-2xl z-50 safe-bottom"
      onClick={() => onClose?.()}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-0 left-0 right-0 glass rounded-t-[32px] p-6 border border-white/5"
      >
        <div className="w-12 h-1 bg-white/30 rounded-full mx-auto mb-6" />
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-white/40">Segment</p>
            <h2 className="text-2xl font-semibold text-white">Stop Tracker</h2>
          </div>
          <div className="text-white/70 text-sm border border-white/10 rounded-full px-3 py-1 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-cyan-300 animate-pulse" />
            {isInNightWindow(new Date(), settings) ? 'Night Window' : 'Day Window'}
          </div>
        </div>
        <div className="glass rounded-2xl p-4 mb-3 border border-white/5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-white/50 text-xs uppercase tracking-[0.2em] mb-1">Segment Miles</p>
              <p className="text-2xl font-semibold text-white">{trackingMiles.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-white/50 text-xs uppercase tracking-[0.2em] mb-1">Trip Miles</p>
              <p className="text-2xl font-semibold text-white">{projMiles.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-white/50 text-xs uppercase tracking-[0.2em] mb-1">Night Segment</p>
              <p className="text-2xl font-semibold text-white">{trackingNightMiles.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-white/50 text-xs uppercase tracking-[0.2em] mb-1">Night CPM</p>
              <p className="text-2xl font-semibold text-white">
                {settings.nightPayEnabled ? `$${(settings.cpm + (settings.nightExtraCpm || 0)).toFixed(2)}` : `$${settings.cpm.toFixed(2)}`}
              </p>
            </div>
          </div>
        </div>
        <div className="glass rounded-2xl p-4 mb-4 border border-white/5">
          <p className="text-white/60 text-xs uppercase tracking-[0.3em] mb-1">Projected Pay</p>
          <div className="text-3xl font-semibold text-white">{formatCurrency(projPay)}</div>
        </div>
        <div className="flex gap-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onArrive}
            className="flex-1 ntransit-cta text-black/80 font-semibold py-3.5 disabled:opacity-50"
          >
            Arrive at stop
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}



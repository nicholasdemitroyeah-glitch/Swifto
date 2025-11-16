'use client';

import { motion } from 'framer-motion';
import { Settings, Load } from '@/lib/db';
import { calculateTripPay, isInNightWindow, formatCurrency } from '@/lib/utils';

interface FullScreenTrackerProps {
  trackingMiles: number;
  trackingNightMiles: number;
  baseTripMiles: number;
  baseNightMiles: number;
  settings: Settings;
  loads: Load[];
  onArrive: () => void;
}

export default function FullScreenTracker({
  trackingMiles,
  trackingNightMiles,
  baseTripMiles,
  baseNightMiles,
  settings,
  loads,
  onArrive,
}: FullScreenTrackerProps) {
  const nowIsNight = isInNightWindow(new Date(), settings);
  const projTripMiles = baseTripMiles + trackingMiles;
  const projNightMiles = baseNightMiles + trackingNightMiles;
  const projectedPay = calculateTripPay(projTripMiles, loads, settings, projNightMiles);

  return (
    <div className="fixed inset-0 z-[100] bg-black">
      <div className="absolute inset-0 flex flex-col">
        {/* Top section */}
        <div className="flex-1 px-5 pt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white">Stop Tracker</h2>
            <div className="text-white/80 text-sm">{nowIsNight ? '🌙 Night' : '☀️ Day'}</div>
          </div>
          <div className="glass rounded-2xl p-5 mb-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-white/60 text-xs mb-1">Segment Miles</p>
                <p className="text-2xl font-bold text-white">{trackingMiles.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-white/60 text-xs mb-1">Trip Miles</p>
                <p className="text-2xl font-bold text-white">{projTripMiles.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-white/60 text-xs mb-1">Segment Night Miles</p>
                <p className="text-2xl font-bold text-white">{trackingNightMiles.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-white/60 text-xs mb-1">Night CPM</p>
                <p className="text-2xl font-bold text-white">
                  {settings.nightPayEnabled ? `$${(settings.cpm + (settings.nightExtraCpm || 0)).toFixed(2)}` : `$${settings.cpm.toFixed(2)}`}
                </p>
              </div>
            </div>
          </div>
          <div className="glass rounded-2xl p-5">
            <p className="text-white/60 text-xs mb-1">Projected Total Pay</p>
            <div className="text-3xl font-bold text-white">{formatCurrency(projectedPay)}</div>
          </div>
        </div>
        {/* Bottom action */}
        <div className="px-5 pb-7">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={onArrive}
            className="w-full rounded-2xl bg-red-600 text-white font-semibold py-4 text-base"
          >
            Arrive
          </motion.button>
        </div>
      </div>
    </div>
  );
}



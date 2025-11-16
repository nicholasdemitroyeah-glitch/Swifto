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
    <div className="fixed inset-0 z-[100] bg-[#01060f]">
      <div className="absolute inset-0 flex flex-col">
        {/* Top section */}
        <div className="flex-1 px-5 pt-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-white/40">Segment</p>
              <h2 className="text-2xl font-semibold text-white">Stop Tracker</h2>
            </div>
            <div className="text-white/80 text-sm border border-white/10 rounded-full px-3 py-1 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-cyan-300 animate-pulse" />
              {nowIsNight ? 'Night Window' : 'Day Window'}
            </div>
          </div>
          <div className="glass rounded-2xl p-5 mb-3 border border-white/5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-white/50 text-xs uppercase tracking-[0.2em] mb-1">Segment Miles</p>
                <p className="text-2xl font-semibold text-white">{trackingMiles.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-white/50 text-xs uppercase tracking-[0.2em] mb-1">Trip Miles</p>
                <p className="text-2xl font-semibold text-white">{projTripMiles.toFixed(2)}</p>
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
          <div className="glass rounded-2xl p-5 border border-white/5">
            <p className="text-white/60 text-xs uppercase tracking-[0.3em] mb-1">Projected Total Pay</p>
            <div className="text-3xl font-semibold text-white">{formatCurrency(projectedPay)}</div>
          </div>
        </div>
        {/* Bottom action */}
        <div className="px-5 pb-7">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={onArrive}
            className="w-full rounded-2xl ntransit-cta text-black/80 font-semibold py-4 text-base"
          >
            Arrive
          </motion.button>
        </div>
      </div>
    </div>
  );
}



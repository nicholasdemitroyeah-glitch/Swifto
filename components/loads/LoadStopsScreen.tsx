'use client';

import { motion } from 'framer-motion';
import { Load } from '@/lib/db';
import { playClick } from '@/lib/sounds';

interface LoadStopsScreenProps {
  load: Load;
  loadIndex: number;
  getFirstUnarrivedStopId: (load: Load) => string | null;
  onBack: () => void;
  onDepartToStop: (stopId: string) => void;
  onDepartToDC: () => void;
}

export default function LoadStopsScreen({
  load,
  loadIndex,
  getFirstUnarrivedStopId,
  onBack,
  onDepartToStop,
  onDepartToDC,
}: LoadStopsScreenProps) {
  const activeStopId = getFirstUnarrivedStopId(load);
  const allDone = !activeStopId;

  return (
    <div className="fixed inset-0 z-[90] ntransit-shell flex flex-col">
      {/* App bar */}
      <div className="safe-top px-4 py-3 flex items-center justify-between">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => { playClick(); onBack(); }}
          className="w-10 h-10 glass rounded-xl flex items-center justify-center text-white/90"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </motion.button>
        <h1 className="text-white font-semibold">LOAD {String(loadIndex + 1).padStart(2, '0')}</h1>
        <div className="w-10" />
      </div>

      {/* Blue header */}
      <div className="px-4 py-5 bg-gradient-to-r from-cyan-500/20 via-cyan-400/10 to-transparent border-b border-white/10">
        <div className="text-white/70 text-xs tracking-[0.4em] uppercase mb-1">
          Load {String(loadIndex + 1).padStart(2, '0')}
        </div>
        <div className="text-white text-3xl font-semibold">Stop Manifest</div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-5 space-y-6 overflow-y-auto">
        {load.stops.map((stop, idx) => {
          const isActive = activeStopId === stop.id && !stop.arrivedAt;
          const isUpcoming = !stop.arrivedAt && !isActive;
          return (
            <div key={stop.id} className="relative">
              <div
                className={`rounded-2xl px-4 py-4 border ${
                  isActive ? 'border-white/20 bg-white/10' : 'border-white/10 bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isActive ? (
                      <span className="inline-block w-3 h-3 bg-red-500 rounded-full" />
                    ) : (
                      <span className="inline-block w-3 h-3 bg-white/20 rounded-full" />
                    )}
                    <div className="text-white">
                      <div className="text-sm font-semibold">Stop {String(idx + 1).padStart(2, '0')}</div>
                      <div className="text-white/60 text-xs">
                        {isActive ? 'In-Progress' : stop.arrivedAt ? 'Arrived' : 'Pending'}
                      </div>
                    </div>
                  </div>
                  {isActive && (
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => { playClick(); onDepartToStop(stop.id); }}
                      className="rounded-full bg-blue-600 text-white px-5 py-3 text-sm font-semibold"
                    >
                      Depart To Stop
                    </motion.button>
                  )}
                </div>
              </div>
              {isUpcoming && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-white text-lg font-semibold">Upcoming Stop</div>
                </div>
              )}
              {/* Dotted connector between cards */}
              {idx < load.stops.length - 1 && (
                <div className="flex items-center justify-center py-3">
                  <div className="flex flex-col items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-white/60" />
                    <span className="w-1 h-1 rounded-full bg-white/60" />
                    <span className="w-1 h-1 rounded-full bg-white/60" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom button */}
      <div className="px-4 pb-6">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => { playClick(); onDepartToDC(); }}
          disabled={!allDone || !!load.finishedAt}
          className={`w-full rounded-2xl py-4 text-base font-semibold ${
            allDone && !load.finishedAt ? 'ntransit-cta text-black/80' : 'bg-white/5 text-white/30'
          }`}
        >
          Head Back To DC
        </motion.button>
      </div>
    </div>
  );
}



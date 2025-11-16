'use client';

import { motion } from 'framer-motion';
import { Load } from '@/lib/db';

interface LoadCardProps {
  load: Load;
  index: number;
  onOpen: () => void;
}

export default function LoadCard({ load, index, onOpen }: LoadCardProps) {
  const completed = !!load.finishedAt;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass rounded-2xl p-3.5 ${completed ? 'opacity-70' : ''}`}
      onClick={onOpen}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-white">Load {index + 1}</h3>
          <span className={`px-2 py-0.5 rounded-full text-xs ${load.loadType === 'wet' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
            {load.loadType === 'wet' ? '💧' : '📦'}
          </span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-white/90">
            {load.stops.length} stops
          </span>
          {completed && (
            <span className="ml-2 inline-flex items-center gap-1 text-green-400 text-xs">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-400" />
              Complete
            </span>
          )}
        </div>
        <div className="text-white/60 text-xs">View</div>
      </div>
    </motion.div>
  );
}



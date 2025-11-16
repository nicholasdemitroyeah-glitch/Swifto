'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { getSettings, saveSettings, Settings } from '@/lib/db';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { hapticLight, hapticMedium, hapticSuccess, hapticError } from '@/lib/haptics';

function minutesToTime(totalMinutes: number): string {
  const minutes = Math.max(0, Math.min(1439, totalMinutes ?? 0));
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function timeToMinutes(value: string): number {
  const [hh, mm] = value.split(':').map((v) => parseInt(v, 10));
  const hours = isNaN(hh) ? 0 : Math.max(0, Math.min(23, hh));
  const minutes = isNaN(mm) ? 0 : Math.max(0, Math.min(59, mm));
  return hours * 60 + minutes;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>({
    cpm: 0,
    payPerLoad: 0,
    payPerStop: 0,
    nightPayEnabled: false,
    nightStartMinutes: 19 * 60,
    nightEndMinutes: 3 * 60,
    nightExtraCpm: 0.06,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;
    const saved = await getSettings(user.uid);
    if (saved) {
      // Merge defaults for newly added fields
      setSettings({
        cpm: saved.cpm ?? 0,
        payPerLoad: saved.payPerLoad ?? 0,
        payPerStop: saved.payPerStop ?? 0,
        nightPayEnabled: saved.nightPayEnabled ?? false,
        nightStartMinutes: saved.nightStartMinutes ?? (19 * 60),
        nightEndMinutes: saved.nightEndMinutes ?? (3 * 60),
        nightExtraCpm: saved.nightExtraCpm ?? 0.06,
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    hapticMedium();
    setSaving(true);
    try {
      await saveSettings(user.uid, settings);
      hapticSuccess();
      router.push('/dashboard');
    } catch (error) {
      console.error('Error saving settings:', error);
      hapticError();
      alert('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center ntransit-shell">
        <div className="text-white/60 tracking-[0.3em] uppercase text-xs">Loading</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col ntransit-shell text-white">
      {/* Top Bar */}
      <div className="flex-shrink-0 safe-top">
        <div className="px-4 pt-2 pb-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => { hapticLight(); router.back(); }}
            className="w-10 h-10 glass rounded-xl flex items-center justify-center text-white/90 mb-3"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </motion.button>
          <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif', fontWeight: 700 }}>
            Settings
          </h1>
        </div>
      </div>

      {/* Scrollable Form */}
      <div className="flex-1 scroll-area safe-left safe-right safe-bottom">
        <div className="px-4 pb-4">
          <div className="space-y-3">
            <div className="glass rounded-2xl p-4">
              <label className="block text-sm font-medium text-white/90 mb-3">Dollars Per Mile (CPM)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60">$</span>
                <input
                  type="number"
                  value={settings.cpm || ''}
                  onChange={(e) => setSettings({ ...settings, cpm: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-10 pr-4 py-4 glass rounded-xl border border-white/10 focus:border-blue-500 focus:outline-none text-white"
                  placeholder="1.00"
                  min="0"
                  step="0.01"
                  style={{ fontSize: '17px' }}
                />
              </div>
            </div>

            <div className="glass rounded-2xl p-4">
              <label className="block text-sm font-medium text-white/90 mb-3">Pay Per Load ($)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60">$</span>
                <input
                  type="number"
                  value={settings.payPerLoad || ''}
                  onChange={(e) => setSettings({ ...settings, payPerLoad: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-10 pr-4 py-4 glass rounded-xl border border-white/10 focus:border-purple-500 focus:outline-none text-white"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  style={{ fontSize: '17px' }}
                />
              </div>
            </div>

            <div className="glass rounded-2xl p-4">
              <label className="block text-sm font-medium text-white/90 mb-3">Pay Per Stop ($)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60">$</span>
                <input
                  type="number"
                  value={settings.payPerStop || ''}
                  onChange={(e) => setSettings({ ...settings, payPerStop: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-10 pr-4 py-4 glass rounded-xl border border-white/10 focus:border-purple-500 focus:outline-none text-white"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  style={{ fontSize: '17px' }}
                />
              </div>
            </div>

            <div className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-white/90">Enable Nightly Pay</label>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, nightPayEnabled: !settings.nightPayEnabled })}
                  className={`w-12 h-7 rounded-full transition ${settings.nightPayEnabled ? 'bg-blue-500' : 'bg-white/20'}`}
                >
                  <span
                    className={`block w-6 h-6 bg-white rounded-full transform transition ${settings.nightPayEnabled ? 'translate-x-6' : 'translate-x-1'} mt-0.5`}
                  />
                </button>
              </div>

              <div className={`grid grid-cols-2 gap-3 ${settings.nightPayEnabled ? '' : 'opacity-50 pointer-events-none'}`}>
                <div>
                  <label className="block text-xs text-white/60 mb-2">Night Start</label>
                  <input
                    type="time"
                    value={minutesToTime(settings.nightStartMinutes ?? 1140)}
                    onChange={(e) => setSettings({ ...settings, nightStartMinutes: timeToMinutes(e.target.value) })}
                    className="w-full px-4 py-3 glass rounded-xl border border-white/10 focus:border-blue-500 focus:outline-none text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-2">Night End</label>
                  <input
                    type="time"
                    value={minutesToTime(settings.nightEndMinutes ?? 180)}
                    onChange={(e) => setSettings({ ...settings, nightEndMinutes: timeToMinutes(e.target.value) })}
                    className="w-full px-4 py-3 glass rounded-xl border border-white/10 focus:border-blue-500 focus:outline-none text-white"
                  />
                </div>
              </div>

              <div className={`mt-3 ${settings.nightPayEnabled ? '' : 'opacity-50 pointer-events-none'}`}>
                <label className="block text-xs text-white/60 mb-2">Night Extra CPM ($/mi)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60">$</span>
                  <input
                    type="number"
                    value={settings.nightExtraCpm ?? 0}
                    onChange={(e) => setSettings({ ...settings, nightExtraCpm: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-10 pr-4 py-4 glass rounded-xl border border-white/10 focus:border-blue-500 focus:outline-none text-white"
                    placeholder="0.06"
                    min="0"
                    step="0.01"
                    style={{ fontSize: '17px' }}
                  />
                </div>
              </div>
            </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSave}
              disabled={saving}
              className="w-full glass rounded-2xl px-6 py-4 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
              style={{ fontSize: '17px', fontWeight: 600 }}
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </span>
              ) : (
                'Save Settings'
              )}
            </motion.button>
          </div>
        </div>
    </div>
  );
}

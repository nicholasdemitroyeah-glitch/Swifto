'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { getSettings, saveSettings, Settings } from '@/lib/db';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { hapticLight, hapticMedium, hapticSuccess, hapticError } from '@/lib/haptics';

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>({
    cpm: 0,
    payPerLoad: 0,
    payPerStop: 0,
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
      setSettings(saved);
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
      <div className="h-full flex items-center justify-center bg-black">
        <div className="text-white text-base">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Fixed Header */}
      <div className="flex-shrink-0 safe-top safe-left safe-right">
        <div className="px-4 pt-3 pb-2">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => { hapticLight(); router.back(); }}
            className="mb-4 glass rounded-xl px-3 py-2 text-white/90 active:opacity-70"
            style={{ fontSize: '14px', fontWeight: 500 }}
          >
            ← Back
          </motion.button>
          <h1 className="text-2xl font-bold text-white mb-1 tracking-tight" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif', fontWeight: 700, letterSpacing: '-0.02em' }}>
            Settings
          </h1>
          <p className="text-white/50 text-xs font-light">Configure your pay rates</p>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 scroll-area safe-left safe-right safe-bottom">
        <div className="px-4 pb-4">
          <div className="space-y-3">
            <div className="glass rounded-2xl p-4">
              <label className="block text-sm font-medium text-white/90 mb-3" style={{ fontSize: '15px', fontWeight: 500 }}>
                Dollars Per Mile (CPM)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 text-lg">$</span>
                <input
                  type="number"
                  value={settings.cpm || ''}
                  onChange={(e) => setSettings({ ...settings, cpm: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-10 pr-4 py-4 glass rounded-xl border border-white/10 focus:border-blue-500 focus:outline-none text-white transition-all"
                  placeholder="1.00"
                  min="0"
                  step="0.01"
                  style={{ fontSize: '17px' }}
                />
              </div>
              <p className="text-white/40 text-xs mt-2">Amount you earn per mile (e.g., 1.00 for $1.00/mile)</p>
            </div>

            <div className="glass rounded-2xl p-4">
              <label className="block text-sm font-medium text-white/90 mb-3" style={{ fontSize: '15px', fontWeight: 500 }}>
                Pay Per Load ($)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 text-lg">$</span>
                <input
                  type="number"
                  value={settings.payPerLoad || ''}
                  onChange={(e) => setSettings({ ...settings, payPerLoad: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-10 pr-4 py-4 glass rounded-xl border border-white/10 focus:border-purple-500 focus:outline-none text-white transition-all"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  style={{ fontSize: '17px' }}
                />
              </div>
            </div>

            <div className="glass rounded-2xl p-4">
              <label className="block text-sm font-medium text-white/90 mb-3" style={{ fontSize: '15px', fontWeight: 500 }}>
                Pay Per Stop ($)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 text-lg">$</span>
                <input
                  type="number"
                  value={settings.payPerStop || ''}
                  onChange={(e) => setSettings({ ...settings, payPerStop: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-10 pr-4 py-4 glass rounded-xl border border-white/10 focus:border-pink-500 focus:outline-none text-white transition-all"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  style={{ fontSize: '17px' }}
                />
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSave}
              disabled={saving}
              className="w-full glass rounded-2xl px-6 py-4 text-white font-semibold active:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
              style={{ fontSize: '17px', fontWeight: 600, fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif' }}
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save Settings
                </>
              )}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}

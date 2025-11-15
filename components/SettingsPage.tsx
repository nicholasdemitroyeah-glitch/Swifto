'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { getSettings, saveSettings, Settings } from '@/lib/db';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

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
    setSaving(true);
    try {
      await saveSettings(user.uid, settings);
      router.push('/dashboard');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 pb-32 relative">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-strong rounded-3xl shadow-2xl p-8 md:p-12 border border-white/10 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full blur-3xl" />
          <div className="relative z-10">
            <div className="mb-8">
              <h1 className="text-5xl font-bold bg-gradient-to-r from-white via-blue-200 to-purple-200 bg-clip-text text-transparent mb-3">
                Settings
              </h1>
              <p className="text-gray-400 text-lg">Configure your pay rates and preferences</p>
            </div>

            <div className="space-y-8">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="glass rounded-2xl p-6 border border-white/10"
              >
                <label className="block text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  Dollars Per Mile (CPM)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">$</span>
                  <input
                    type="number"
                    value={settings.cpm || ''}
                    onChange={(e) => setSettings({ ...settings, cpm: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-8 pr-4 py-4 bg-dark-700/50 border-2 border-dark-600 rounded-xl focus:border-blue-500 focus:outline-none text-lg text-white transition-all"
                    placeholder="1.00"
                    min="0"
                    step="0.01"
                  />
                </div>
                <p className="text-gray-500 text-sm mt-2">Enter the amount you earn per mile (e.g., 1.00 for $1.00 per mile)</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="glass rounded-2xl p-6 border border-white/10"
              >
                <label className="block text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  Pay Per Load ($)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">$</span>
                  <input
                    type="number"
                    value={settings.payPerLoad || ''}
                    onChange={(e) => setSettings({ ...settings, payPerLoad: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-8 pr-4 py-4 bg-dark-700/50 border-2 border-dark-600 rounded-xl focus:border-purple-500 focus:outline-none text-lg text-white transition-all"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="glass rounded-2xl p-6 border border-white/10"
              >
                <label className="block text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Pay Per Stop ($)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">$</span>
                  <input
                    type="number"
                    value={settings.payPerStop || ''}
                    onChange={(e) => setSettings({ ...settings, payPerStop: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-8 pr-4 py-4 bg-dark-700/50 border-2 border-dark-600 rounded-xl focus:border-pink-500 focus:outline-none text-lg text-white transition-all"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
              </motion.div>

              <motion.button
                whileHover={{ scale: 1.02, boxShadow: '0 20px 40px rgba(59, 130, 246, 0.3)' }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white font-bold py-5 rounded-2xl text-lg shadow-2xl transition-all disabled:opacity-50 relative overflow-hidden group"
              >
                <span className="relative z-10 flex items-center justify-center gap-3">
                  {saving ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Save Settings
                    </>
                  )}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

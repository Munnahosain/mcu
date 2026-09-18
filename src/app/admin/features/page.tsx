"use client";

import { useEffect, useState } from 'react';
import { Flag, Plus, ShieldCheck } from 'lucide-react';

type FeatureFlag = {
  _id: string;
  key: string;
  enabled: boolean;
  plans: string[];
  createdAt?: string;
  updatedAt?: string;
};

export default function AdminFeaturesPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [key, setKey] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [plansText, setPlansText] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadFlags = async () => {
    try {
      const response = await fetch('/api/admin/features', { credentials: 'include' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to load feature flags.');
      setFlags(payload.flags || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load feature flags.');
    }
  };

  useEffect(() => {
    void loadFlags();
  }, []);

  const submitFlag = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');

    const response = await fetch('/api/admin/features', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: key.trim(),
        enabled,
        plans: plansText.split(',').map((item) => item.trim()).filter(Boolean),
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || 'Unable to save feature flag.');
      return;
    }

    setKey('');
    setEnabled(true);
    setPlansText('');
    setMessage('Feature flag saved.');
    void loadFlags();
  };

  const toggleFlag = async (flag: FeatureFlag) => {
    setError('');
    setMessage('');

    const response = await fetch('/api/admin/features', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: flag.key, enabled: !flag.enabled, plans: flag.plans }),
    });

    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || 'Unable to update feature flag.');
      return;
    }

    setMessage(`Feature flag ${flag.key} updated.`);
    void loadFlags();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <section>
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Launch controls</p>
        <h2 className="mt-2 text-3xl font-black">Feature flags</h2>
        <p className="mt-2 text-sm text-white/55">Enable or disable product features by key and plan availability.</p>
      </section>

      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
      {message && <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm text-primary">{message}</div>}

      <div className="grid gap-6 xl:grid-cols-[1fr_1.5fr]">
        <form onSubmit={submitFlag} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur-xl">
          <div className="mb-5 flex items-center gap-2 text-sm font-bold">
            <Plus className="h-4 w-4 text-primary" />
            Create feature flag
          </div>

          <div className="space-y-4">
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
              Key
              <input
                value={key}
                onChange={(event) => setKey(event.target.value)}
                placeholder="new-feature"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-primary/60"
                required
              />
            </label>

            <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white/75">
              <span>Enabled</span>
              <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="h-4 w-4 accent-primary" />
            </label>

            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
              Plans
              <input
                value={plansText}
                onChange={(event) => setPlansText(event.target.value)}
                placeholder="pro, agency"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-primary/60"
              />
            </label>
          </div>

          <button type="submit" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-[#06251b] hover:bg-primary-hover">
            <ShieldCheck className="h-4 w-4" />
            Save flag
          </button>
        </form>

        <section className="space-y-3">
          {flags.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-sm text-white/50">
              No feature flags configured yet.
            </div>
          ) : (
            flags.map((flag) => (
              <div key={flag._id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-xl backdrop-blur-xl">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary/80">{flag.key}</p>
                    <p className="mt-2 text-sm text-white/60">Plans: {flag.plans.length ? flag.plans.join(', ') : 'All plans'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void toggleFlag(flag)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold ${flag.enabled ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}
                  >
                    {flag.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}

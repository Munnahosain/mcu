"use client";

import { useEffect, useState } from 'react';
import { Plus, ShieldCheck, Trash2 } from 'lucide-react';

type FeatureFlag = {
  _id: string;
  key: string;
  enabled: boolean;
  plans: string[];
  message?: string;
  createdAt?: string;
  updatedAt?: string;
};

const supportedFlags = [
  { key: 'analysis', description: 'Adobe Stock market research and asset analysis' },
  { key: 'ai_tools', description: 'All AI generation endpoints' },
  { key: 'metadata_generation', description: 'Stock metadata generation' },
  { key: 'prompt_generation', description: 'AI prompt generation' },
  { key: 'general_ai', description: 'Event ideas and general AI operations' },
  { key: 'svg_motion', description: 'SVG Motion AI animation plans' },
  { key: 'background_removal', description: 'Background remover' },
  { key: 'bg_remover', description: 'Legacy fallback for background_removal; ignored when the main flag exists' },
  { key: 'export_high_res', description: 'High-resolution Typebox exports' },
  { key: 'advanced_metadata', description: 'Advanced metadata operations' },
  { key: 'batch_generation', description: 'Batch generation operations' },
  { key: 'advanced_ai', description: 'Advanced AI operations' },
  { key: 'heavy_ai', description: 'Heavy AI operations' },
  { key: 'three_d_generation', description: '3D Studio generation' },
  { key: 'grid_generation', description: 'Grid generator' },
  { key: 'palette_generation', description: 'Palette Studio generation' },
  { key: 'typebox_generation', description: 'Typebox generation' },
  { key: 'bento_generation', description: 'Bento generation' },
  { key: 'ascii_generation', description: 'ASCII Studio generation' },
  { key: 'trading_generation', description: 'Trading chart generation' },
  { key: 'splitter_export', description: 'Vector splitter exports' },
  { key: 'motion_generation', description: 'Motion generation operations' },
  { key: 'color_extraction', description: 'Color extraction' },
  { key: 'vector_splitter', description: 'Vector splitter operations' },
];

export default function AdminFeaturesPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [key, setKey] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [plansText, setPlansText] = useState('');
  const [disabledMessage, setDisabledMessage] = useState('');
  const [keyFilter, setKeyFilter] = useState('');
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
        message: disabledMessage,
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
    setDisabledMessage('');
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
      body: JSON.stringify({ key: flag.key, enabled: !flag.enabled, plans: flag.plans, message: flag.message || '' }),
    });

    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || 'Unable to update feature flag.');
      return;
    }

    setMessage(`Feature flag ${flag.key} updated.`);
    void loadFlags();
  };

  const deleteFlag = async (flag: FeatureFlag) => {
    if (!confirm(`Delete custom feature flag "${flag.key}"?`)) return;
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/features', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: flag.key }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to delete feature flag.');
      setMessage(`Feature flag ${flag.key} deleted.`);
      await loadFlags();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to delete feature flag.');
    }
  };

  const filteredFlags = supportedFlags.filter(({ key: flagKey, description }) =>
    `${flagKey} ${description}`.toLowerCase().includes(keyFilter.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <section>
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Launch controls</p>
        <h2 className="mt-2 text-3xl font-black">Feature flags</h2>
        <p className="mt-2 text-sm text-white/55">
          Create a supported flag, then click its Enabled/Disabled button to apply the change immediately.
          Use <code>ai_tools</code> for all AI generation, operation keys such as <code>metadata_generation</code> or <code>svg_motion</code> for one tool,
          and <code>export_high_res</code> for high-resolution Typebox exports.
        </p>
      </section>

      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
      {message && <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm text-primary">{message}</div>}

      <div className="space-y-6">
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
            {!enabled ? (
              <p className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-200">
                Master switch is off, so this feature is blocked for every plan. Turn it on to use the allowed-plans list below.
              </p>
            ) : null}

            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
              Plans blocked from using this feature
              <span className="mt-1 block normal-case tracking-normal text-white/55">
                This is a block-list. Plans listed here cannot use this feature; plans not listed can. Leave empty to allow every plan.
              </span>
              <input
                value={plansText}
                onChange={(event) => setPlansText(event.target.value)}
                placeholder="free"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-primary/60"
              />
              {plansText.split(',').map((plan) => plan.trim().toLowerCase()).filter(Boolean).length === 1 &&
              plansText.split(',').map((plan) => plan.trim().toLowerCase()).filter(Boolean)[0] === 'free' ? (
                <span className="mt-2 block normal-case tracking-normal text-amber-300">
                  Free plan is blocked; plans not listed remain enabled.
                </span>
              ) : null}
            </label>

            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
              Message shown when feature is unavailable
              <span className="mt-1 block normal-case tracking-normal text-white/55">
                This message appears on the disabled feature page. Leave empty to use the default message.
              </span>
              <textarea
                value={disabledMessage}
                onChange={(event) => setDisabledMessage(event.target.value.slice(0, 500))}
                placeholder="This feature is temporarily unavailable for your plan."
                maxLength={500}
                rows={3}
                className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-primary/60"
              />
              <span className="mt-1 block text-right normal-case tracking-normal text-white/40">{disabledMessage.length}/500</span>
            </label>
          </div>

          <button type="submit" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-[#06251b] hover:bg-primary-hover">
            <ShieldCheck className="h-4 w-4" />
            Save flag
          </button>
        </form>

        <section className="space-y-3">
          <h3 className="text-sm font-bold">Configured feature flags</h3>
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
                    <p className="mt-2 text-sm text-white/60">
                      Blocked plans: {flag.plans.length ? flag.plans.join(', ') : 'None (all plans can use this feature)'}
                    </p>
                    {flag.message ? <p className="mt-2 text-sm text-white/45">{flag.message}</p> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void toggleFlag(flag)}
                      aria-pressed={flag.enabled}
                      title="Click to enable or disable this feature flag"
                      className={`rounded-full px-3 py-1.5 text-xs font-bold ${flag.enabled ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}
                    >
                      {flag.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                    {!supportedFlags.some(({ key: supportedKey }) => supportedKey === flag.key) ? (
                      <button
                        type="button"
                        onClick={() => void deleteFlag(flag)}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-500/25 px-2.5 py-1.5 text-xs font-bold text-red-300 hover:bg-red-500/10"
                        aria-label={`Delete custom flag ${flag.key}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold">Supported feature keys</h3>
            <p className="mt-1 text-xs text-white/50">Click a key to fill the form above. Supported keys cannot be deleted; disable them instead.</p>
          </div>
          <input
            value={keyFilter}
            onChange={(event) => setKeyFilter(event.target.value)}
            placeholder="Search keys"
            aria-label="Search supported feature keys"
            className="w-full max-w-xs rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-primary/60"
          />
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filteredFlags.map(({ key: flagKey, description }) => {
            const existingFlag = flags.find((flag) => flag.key === flagKey);
            return (
              <button
                key={flagKey}
                type="button"
                onClick={() => {
                  setKey(flagKey);
                  setEnabled(existingFlag?.enabled ?? true);
                  setPlansText(existingFlag?.plans.join(', ') ?? '');
                  setDisabledMessage(existingFlag?.message ?? '');
                  setError('');
                  setMessage('');
                }}
                className="rounded-xl border border-white/10 bg-black/20 p-3 text-left transition hover:border-primary/50 hover:bg-primary/5"
              >
                <span className="flex items-center justify-between gap-2">
                  <code className="text-xs font-bold text-primary">{flagKey}</code>
                  <span className={`text-[10px] font-bold ${existingFlag ? (existingFlag.enabled ? 'text-emerald-300' : 'text-red-300') : 'text-white/40'}`}>
                    {existingFlag ? (existingFlag.enabled ? 'Enabled' : 'Disabled') : 'Not added'}
                  </span>
                </span>
                <span className="mt-1 block text-xs text-white/50">{description}</span>
              </button>
            );
          })}
        </div>
        {filteredFlags.length === 0 ? <p className="mt-4 text-sm text-white/50">No matching keys.</p> : null}
      </section>
    </div>
  );
}

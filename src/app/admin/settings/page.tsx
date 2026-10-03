"use client";

import { useEffect, useState } from 'react';
import { Database, Pencil, Plus, Save, X } from 'lucide-react';

type SystemSetting = {
  _id: string;
  key: string;
  value: unknown;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

function formatValue(value: unknown) {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return 'null';
  return JSON.stringify(value, null, 2);
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [key, setKey] = useState('');
  const [valueText, setValueText] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings', { credentials: 'include' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to load settings.');
      setSettings(payload.settings || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load settings.');
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  const submitSetting = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');

    let parsed: unknown = valueText;
    try {
      parsed = valueText === '' ? '' : JSON.parse(valueText);
    } catch {
      parsed = valueText;
    }

    const response = await fetch('/api/admin/settings', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: key.trim(), value: parsed }),
    });

    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || 'Unable to save setting.');
      return;
    }

    setKey('');
    setValueText('');
    setMessage(editingKey ? 'System setting updated.' : 'System setting saved.');
    setEditingKey(null);
    void loadSettings();
  };

  const editSetting = (setting: SystemSetting) => {
    setEditingKey(setting.key);
    setKey(setting.key);
    setValueText(formatValue(setting.value));
    setError('');
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setKey('');
    setValueText('');
  };

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <section>
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Runtime config</p>
        <h2 className="mt-2 text-3xl font-black">System settings</h2>
        <p className="mt-2 text-sm text-white/55">Manage operational settings used across the product.</p>

        {/* Quick Settings Links */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <a
            href="/admin/settings/storage"
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-primary/40 hover:bg-primary/5"
          >
            <div>
              <p className="text-sm font-bold text-white">AWS S3 Cloud Storage</p>
              <p className="text-xs text-white/50">Configure S3 Buckets &amp; Pre-Signed URLs</p>
            </div>
            <span className="text-xs font-bold text-primary">Configure &rarr;</span>
          </a>

          <a
            href="/admin/settings/payment"
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-primary/40 hover:bg-primary/5"
          >
            <div>
              <p className="text-sm font-bold text-white">MFS Payment Gateways</p>
              <p className="text-xs text-white/50">Manage bKash, Nagad, Rocket, Upay</p>
            </div>
            <span className="text-xs font-bold text-primary">Configure &rarr;</span>
          </a>
        </div>
      </section>

      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
      {message && <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm text-primary">{message}</div>}

      <div className="space-y-6">
        <form onSubmit={submitSetting} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur-xl">
          <div className="mb-5 flex items-center gap-2 text-sm font-bold">
            <Plus className="h-4 w-4 text-primary" />
            {editingKey ? `Edit system setting: ${editingKey}` : 'Add system setting'}
          </div>

          <div className="space-y-4">
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
              Key
              <input
                value={key}
                onChange={(event) => setKey(event.target.value)}
                placeholder="maintenance_mode"
                readOnly={editingKey !== null}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-primary/60"
                required
              />
            </label>

            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
              Value
              <textarea
                value={valueText}
                onChange={(event) => setValueText(event.target.value)}
                placeholder='"enabled" or {"mode":"maintenance"}'
                className="mt-2 min-h-28 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-primary/60"
                required
              />
            </label>
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button type="submit" className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-[#06251b] hover:bg-primary-hover">
              <Save className="h-4 w-4" />
              {editingKey ? 'Update setting' : 'Save setting'}
            </button>
            {editingKey ? (
              <button
                type="button"
                onClick={cancelEdit}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white/75 hover:bg-white/5"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <section className="space-y-3">
          {settings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-sm text-white/50">
              No system settings found.
            </div>
          ) : (
            settings.map((setting) => (
              <div key={setting._id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-xl backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary/80">{setting.key}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => editSetting(setting)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 px-2.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/10"
                      aria-label={`Edit ${setting.key}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <Database className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-black/20 p-4 font-mono text-xs leading-relaxed text-white/75">
                  {formatValue(setting.value)}
                </pre>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}

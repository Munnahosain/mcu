'use client';

import { useEffect, useState } from 'react';
import { Save, CheckCircle2, AlertCircle, RefreshCw, CreditCard, Sparkles } from 'lucide-react';

type SupportedProvider = 'bkash' | 'nagad' | 'rocket' | 'upay';

type ProviderRule = {
  key: string;
  name: string;
  txIdLengthHint: string;
  txIdExample: string;
  senderPlaceholder: string;
  senderHint: string;
  defaultInstructions: string;
};

type PaymentSettings = {
  provider: SupportedProvider;
  enabled: boolean;
  paymentMethod: string;
  accountNumber: string;
  accountType: 'merchant' | 'personal' | 'agent';
  instructions: string;
  minimumAmount: number;
  maximumAmount: number | null;
};

const PROVIDER_METADATA: Record<
  SupportedProvider,
  { name: string; tagColor: string; bgAccent: string; defaultAccountType: 'merchant' | 'personal' | 'agent' }
> = {
  bkash: {
    name: 'bKash',
    tagColor: 'border-pink-500/40 text-pink-400 bg-pink-500/10',
    bgAccent: 'hover:border-pink-500/30',
    defaultAccountType: 'merchant',
  },
  nagad: {
    name: 'Nagad',
    tagColor: 'border-orange-500/40 text-orange-400 bg-orange-500/10',
    bgAccent: 'hover:border-orange-500/30',
    defaultAccountType: 'merchant',
  },
  rocket: {
    name: 'Rocket',
    tagColor: 'border-purple-500/40 text-purple-400 bg-purple-500/10',
    bgAccent: 'hover:border-purple-500/30',
    defaultAccountType: 'personal',
  },
  upay: {
    name: 'Upay',
    tagColor: 'border-cyan-500/40 text-cyan-400 bg-cyan-500/10',
    bgAccent: 'hover:border-cyan-500/30',
    defaultAccountType: 'agent',
  },
};

const defaultSettings = (provider: SupportedProvider = 'bkash'): PaymentSettings => ({
  provider,
  enabled: false,
  paymentMethod: 'manual',
  accountNumber: '',
  accountType: PROVIDER_METADATA[provider]?.defaultAccountType || 'merchant',
  instructions: '',
  minimumAmount: 0,
  maximumAmount: null,
});

export default function PaymentSettingsPage() {
  const [selectedProvider, setSelectedProvider] = useState<SupportedProvider>('bkash');
  const [settings, setSettings] = useState<PaymentSettings>(defaultSettings('bkash'));
  const [rules, setRules] = useState<Record<string, ProviderRule>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadProviderSettings = async (provider: SupportedProvider) => {
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch(`/api/admin/payment-settings?provider=${provider}`);
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load settings.');
      }
      setSettings({
        ...defaultSettings(provider),
        ...data.settings,
        provider,
      });
      if (data.rules) {
        setRules(data.rules);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load payment settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProviderSettings(selectedProvider);
  }, [selectedProvider]);

  const handleProviderTabClick = (provider: SupportedProvider) => {
    if (provider === selectedProvider) return;
    setSelectedProvider(provider);
  };

  const handleApplyTemplate = () => {
    const defaultInst = rules[selectedProvider]?.defaultInstructions;
    if (defaultInst) {
      setSettings((prev) => ({ ...prev, instructions: defaultInst }));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/admin/payment-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          provider: selectedProvider,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update payment settings.');
      }

      setSettings((prev) => ({ ...prev, ...data.settings }));
      setMessage(`${PROVIDER_METADATA[selectedProvider].name} settings saved successfully!`);
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const activeRule = rules[selectedProvider];

  return (
    <div className="mx-auto max-w-4xl space-y-7 pb-12">
      {/* Header */}
      <section>
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Payment gateway configuration</p>
        <h2 className="mt-2 text-3xl font-black text-white">Manual MFS Payment Settings</h2>
        <p className="mt-2 text-sm text-white/55">
          Configure mobile financial service providers (bKash, Nagad, Rocket, Upay). Submissions are strictly verified
          with provider-specific Transaction ID and phone number formats.
        </p>
      </section>

      {/* Provider Selector Tabs */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(['bkash', 'nagad', 'rocket', 'upay'] as SupportedProvider[]).map((prov) => {
          const meta = PROVIDER_METADATA[prov];
          const isSelected = selectedProvider === prov;
          return (
            <button
              key={prov}
              type="button"
              onClick={() => handleProviderTabClick(prov)}
              className={`flex items-center justify-center gap-2 rounded-2xl border p-4 text-sm font-bold transition ${
                isSelected
                  ? 'border-primary bg-primary/15 text-primary shadow-lg ring-1 ring-primary/30'
                  : 'border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              <CreditCard className="h-4 w-4" />
              <span>{meta.name}</span>
            </button>
          );
        })}
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm text-primary">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <span>{message}</span>
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleSave} className="space-y-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-black text-white">{PROVIDER_METADATA[selectedProvider].name} Configuration</h3>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${PROVIDER_METADATA[selectedProvider].tagColor}`}>
              {selectedProvider.toUpperCase()}
            </span>
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm font-bold text-white">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
              className="h-4 w-4 rounded accent-primary"
            />
            <span>Enable {PROVIDER_METADATA[selectedProvider].name} Checkout</span>
          </label>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 py-12 text-sm text-white/50">
            <RefreshCw className="h-5 w-5 animate-spin text-primary" /> Loading provider configuration...
          </div>
        ) : (
          <>
            {/* Format Rule Hint Card */}
            {activeRule && (
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-xs text-white/70">
                <p className="font-bold text-primary">Validation Rule for {activeRule.name}:</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div>
                    <span className="text-white/40">Transaction ID Rule:</span>{' '}
                    <code className="font-mono text-white/90">{activeRule.txIdLengthHint}</code> (e.g.{' '}
                    <span className="font-mono text-primary">{activeRule.txIdExample}</span>)
                  </div>
                  <div>
                    <span className="text-white/40">Sender Phone Rule:</span>{' '}
                    <code className="font-mono text-white/90">{activeRule.senderHint}</code>
                  </div>
                </div>
              </div>
            )}

            {/* Account Details */}
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-white/60">
                {PROVIDER_METADATA[selectedProvider].name} Account / Wallet Number
                <input
                  type="text"
                  required
                  value={settings.accountNumber}
                  onChange={(e) => setSettings({ ...settings, accountNumber: e.target.value })}
                  placeholder={activeRule?.senderPlaceholder || '01XXXXXXXXX'}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-sm text-white outline-none transition focus:border-primary"
                />
              </label>

              <label className="block text-xs font-bold uppercase tracking-wider text-white/60">
                Account Type
                <select
                  value={settings.accountType}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      accountType: e.target.value as 'merchant' | 'personal' | 'agent',
                    })
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-primary"
                >
                  <option value="merchant">Merchant (Payment / Make Payment)</option>
                  <option value="personal">Personal (Send Money)</option>
                  <option value="agent">Agent (Cash Out)</option>
                </select>
              </label>
            </div>

            {/* Payment Instructions */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-white/60">
                  User Payment Instructions
                </label>
                {activeRule?.defaultInstructions && (
                  <button
                    type="button"
                    onClick={handleApplyTemplate}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                  >
                    <Sparkles className="h-3 w-3" /> Load Default Template
                  </button>
                )}
              </div>
              <textarea
                value={settings.instructions}
                onChange={(e) => setSettings({ ...settings, instructions: e.target.value })}
                rows={5}
                placeholder={`1. Open ${PROVIDER_METADATA[selectedProvider].name} app\n2. Select ${settings.accountType === 'merchant' ? 'Make Payment' : 'Send Money'}\n3. Enter exact plan amount and submit TrxID.`}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 p-4 text-xs font-normal leading-relaxed text-white outline-none transition focus:border-primary"
              />
            </div>

            {/* Min / Max Limits */}
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-white/60">
                Minimum Amount (BDT)
                <input
                  type="number"
                  min="0"
                  value={settings.minimumAmount}
                  onChange={(e) => setSettings({ ...settings, minimumAmount: Number(e.target.value) })}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-primary"
                />
              </label>

              <label className="block text-xs font-bold uppercase tracking-wider text-white/60">
                Maximum Amount (Optional BDT)
                <input
                  type="number"
                  min="0"
                  value={settings.maximumAmount ?? ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      maximumAmount: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="Unlimited"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-primary"
                />
              </label>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-background transition hover:brightness-110 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" /> Saving Changes...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" /> Save {PROVIDER_METADATA[selectedProvider].name} Settings
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

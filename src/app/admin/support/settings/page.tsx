'use client';

import Link from 'next/link';
import { ArrowLeft, ExternalLink, Save } from 'lucide-react';
import { useEffect, useState } from 'react';

type WhatsAppSettings = { enabled: boolean; number: string; message: string; availabilityText: string; validNumber?: boolean; previewUrl?: string };
type Settings = { supportEnabled: boolean; allowNewTickets: boolean; autoResponse: boolean; emailNotifications: boolean; whatsapp: WhatsAppSettings };

const defaults: Settings = { supportEnabled: true, allowNewTickets: true, autoResponse: true, emailNotifications: false, whatsapp: { enabled: false, number: '', message: '', availabilityText: '' } };

export default function AdminSupportSettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaults);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/admin/support/settings').then((response) => response.json()).then((data) => {
      if (data.success) setSettings({ ...defaults, ...data.settings, whatsapp: { ...defaults.whatsapp, ...data.settings.whatsapp } });
      else setError(data.error || 'Unable to load settings.');
    }).catch(() => setError('Unable to load settings.'));
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setMessage(''); setError('');
    try {
      const response = await fetch('/api/admin/support/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save settings.');
      setSettings({ ...defaults, ...data.settings, whatsapp: { ...defaults.whatsapp, ...data.settings.whatsapp } }); setMessage('Support settings saved.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save settings.'); } finally { setSaving(false); }
  };

  const updateWhatsApp = (patch: Partial<WhatsAppSettings>) => setSettings((current) => ({ ...current, whatsapp: { ...current.whatsapp, ...patch } }));

  return <div className="mx-auto max-w-3xl space-y-7">
    <section className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Support configuration</p><h1 className="mt-2 text-3xl font-black">Support Settings</h1><p className="mt-2 text-sm text-foreground/60">Configure tickets and the external WhatsApp support channel.</p></div>
      <Link href="/admin/support" className="inline-flex items-center gap-2 rounded-xl border border-foreground/15 bg-foreground/[0.04] px-4 py-2.5 text-sm font-bold hover:border-primary/40 hover:text-primary" title="Back to Support"><ArrowLeft className="h-4 w-4" /> Support</Link>
    </section>
    {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">{error}</div> : null}
    {message ? <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm text-primary">{message}</div> : null}
    <form onSubmit={save} className="space-y-7 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-6">
      <section className="space-y-4"><h2 className="text-lg font-black">Support system</h2>
        {([['supportEnabled', 'Support Enabled'], ['allowNewTickets', 'Allow New Tickets'], ['autoResponse', 'Auto Response'], ['emailNotifications', 'Email Notifications']] as const).map(([key, label]) => <label key={key} className="flex items-center gap-3 text-sm font-bold"><input type="checkbox" checked={settings[key]} onChange={(event) => setSettings({ ...settings, [key]: event.target.checked })} className="accent-primary" /> {label}</label>)}
      </section>
      <section className="space-y-4 border-t border-foreground/10 pt-6"><div><h2 className="text-lg font-black">WhatsApp Support</h2><p className="mt-1 text-xs text-foreground/55">Only a secure click-to-chat link is generated. No WhatsApp messages are stored.</p></div>
        <label className="flex items-center gap-3 text-sm font-bold"><input type="checkbox" checked={settings.whatsapp.enabled} onChange={(event) => updateWhatsApp({ enabled: event.target.checked })} className="accent-primary" /> Enable WhatsApp Support</label>
        <label className="block text-xs font-bold text-foreground/70">WhatsApp Support Number<input value={settings.whatsapp.number} onChange={(event) => updateWhatsApp({ number: event.target.value })} placeholder="8801XXXXXXXXX" className="mt-2 w-full rounded-xl border border-foreground/15 bg-background px-3 py-3 text-sm text-foreground outline-none focus:border-primary" /><span className="mt-1 block text-[11px] font-normal text-foreground/50">International format, without +, spaces, hyphens, or brackets.</span></label>
        <label className="block text-xs font-bold text-foreground/70">Default WhatsApp Message<textarea value={settings.whatsapp.message} onChange={(event) => updateWhatsApp({ message: event.target.value })} rows={7} placeholder="Hi MCUSTOCK Support..." className="mt-2 w-full rounded-xl border border-foreground/15 bg-background px-3 py-3 text-sm text-foreground outline-none focus:border-primary" /></label>
        <p className="text-[11px] text-foreground/55">Use <code className="text-primary">{'{USER_ID}'}</code> and <code className="text-primary">{'{USER_EMAIL}'}</code> for logged-in user details.</p>
        <label className="block text-xs font-bold text-foreground/70">Support Availability Text<input value={settings.whatsapp.availabilityText} onChange={(event) => updateWhatsApp({ availabilityText: event.target.value })} placeholder="Usually replies during business hours." className="mt-2 w-full rounded-xl border border-foreground/15 bg-background px-3 py-3 text-sm text-foreground outline-none focus:border-primary" /></label>
        {settings.whatsapp.previewUrl ? <a href={settings.whatsapp.previewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-primary/30 px-4 py-2.5 text-xs font-bold text-primary hover:bg-primary/10">Preview WhatsApp Link <ExternalLink className="h-3.5 w-3.5" /></a> : <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">Configure a valid number and save to preview the WhatsApp link.</p>}
      </section>
      <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-background disabled:opacity-50"><Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Settings'}</button>
    </form>
  </div>;
}

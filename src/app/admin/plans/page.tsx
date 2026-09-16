"use client";

import { FormEvent, useEffect, useState } from 'react';
import { Check, CreditCard, Plus, Power } from 'lucide-react';

type Plan = { _id: string; name: string; slug: string; price: number; billingInterval: string; monthlyCredits: number; active: boolean; features: string[] };

const emptyForm = { name: '', slug: '', price: '0', monthlyCredits: '0', features: '' };

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadPlans = () => fetch('/api/admin/plans', { credentials: 'include' }).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Unable to load plans.'); setPlans(data.plans); }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load plans.'));
  useEffect(() => { void loadPlans(); }, []);

  const createPlan = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setMessage('');
    const response = await fetch('/api/admin/plans', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, price: Number(form.price), monthlyCredits: Number(form.monthlyCredits), features: form.features.split(',').map((item) => item.trim()).filter(Boolean) }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error || 'Unable to create plan.'); return; }
    setForm(emptyForm); setMessage('Plan created.'); void loadPlans();
  };

  const togglePlan = async (plan: Plan) => {
    const response = await fetch(`/api/admin/plans/${plan._id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !plan.active }) });
    const data = await response.json(); if (!response.ok) { setError(data.error || 'Unable to update plan.'); return; } void loadPlans();
  };

  return <div className="mx-auto max-w-7xl space-y-7"><section><p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Commercial controls</p><h2 className="mt-2 text-3xl font-black">Plans</h2><p className="mt-2 text-sm text-white/55">Manage server-side plan definitions without changing application code.</p></section>{error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}{message && <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm text-primary">{message}</div>}<div className="grid gap-6 xl:grid-cols-[1fr_1.5fr]"><form onSubmit={createPlan} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur-xl"><div className="flex items-center gap-2 text-sm font-bold"><Plus className="h-4 w-4 text-primary" /> Create plan</div><div className="mt-5 space-y-3">{([['name','Name'],['slug','Slug'],['price','Price'],['monthlyCredits','Monthly credits'],['features','Features, comma separated']] as const).map(([key,label]) => <label key={key} className="block text-xs font-semibold text-white/55">{label}<input required={key !== 'features'} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-primary/60" /></label>)}</div><button className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-[#06251b] hover:bg-primary-hover"><Plus className="h-4 w-4" /> Create plan</button></form><section className="space-y-3">{plans.map((plan) => <div key={plan._id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-xl backdrop-blur-xl"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h3 className="text-lg font-black">{plan.name}</h3><span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase text-primary">{plan.slug}</span></div><p className="mt-1 text-sm text-white/50">${plan.price} / {plan.billingInterval} · {plan.monthlyCredits} credits</p></div><button onClick={() => void togglePlan(plan)} className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${plan.active ? 'bg-primary/15 text-primary' : 'bg-white/10 text-white/45'}`}><Power className="h-3.5 w-3.5" />{plan.active ? 'Active' : 'Inactive'}</button></div><div className="mt-4 flex flex-wrap gap-2">{plan.features.map((feature) => <span key={feature} className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/60"><Check className="h-3 w-3 text-primary" />{feature}</span>)}</div></div>)}{!plans.length && <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-white/45"><CreditCard className="mx-auto mb-3 h-6 w-6" />No plans configured yet.</div>}</section></div></div>;
}
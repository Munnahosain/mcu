"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

type AdminUser = { _id: string; name: string; email: string; role: string; status: string; createdAt: string; lastLoginAt?: string | null; planId?: { name: string; slug: string; price: number; billingInterval: string; monthlyCredits: number } | string | null; credits?: { monthly?: number; bonus?: number; used?: number } };

export default function AdminUserDetailsPage() {
  const params = useParams<{ id: string }>();
  const userId = params?.id;
  const [user, setUser] = useState<AdminUser | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [amount, setAmount] = useState('100');
  const [plans, setPlans] = useState<Array<{ _id: string; name: string; slug: string; price: number; billingInterval: string }>>([]);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/admin/users/${userId}`, { credentials: 'include' }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to load user.');
      setUser(payload.user);
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load user.'));
  }, [userId]);

  useEffect(() => {
    fetch('/api/admin/plans', { credentials: 'include' }).then((response) => response.json()).then((payload) => setPlans(payload.plans || [])).catch(() => undefined);
  }, []);

  if (error) return <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>;
  if (!user) return <p className="text-sm text-white/50">Loading user...</p>;

  const changeCredits = async (action: 'add' | 'remove' | 'reset') => {
    if (!userId) return;
    setError('');
    setMessage('');
    const response = await fetch(`/api/admin/users/${userId}/credits`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, amount: Number(amount) }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || 'Unable to update credits.');
      return;
    }
    setUser(payload.user);
    setMessage(action === 'reset' ? 'Credits reset.' : `Credits ${action === 'add' ? 'added' : 'removed'}.`);
  };

  const assignPlan = async (planId: string) => {
    if (!userId) return;
    setError(''); setMessage('');
    const response = await fetch(`/api/admin/users/${userId}/plan`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planId }) });
    const payload = await response.json();
    if (!response.ok) { setError(payload.error || 'Unable to assign plan.'); return; }
    setUser(payload.user); setMessage(`Plan changed to ${payload.plan.name}.`);
  };

  const changeStatus = async (status: 'active' | 'suspended' | 'banned' | 'pending') => {
    if (!userId) return;
    setError(''); setMessage('');
    const response = await fetch(`/api/admin/users/${userId}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    const payload = await response.json();
    if (!response.ok) { setError(payload.error || 'Unable to update account access.'); return; }
    setUser(payload.user); setMessage(`Account status changed to ${status}.`);
  };

  return <div className="mx-auto max-w-4xl space-y-6"><Link href="/admin/users" className="inline-flex items-center gap-2 text-sm font-semibold text-white/55 hover:text-primary"><ArrowLeft className="h-4 w-4" /> Back to users</Link>{error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}{message && <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm text-primary">{message}</div>}<section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-xl"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">User profile</p><h2 className="mt-2 text-3xl font-black">{user.name}</h2><p className="mt-1 text-sm text-white/50">{user.email}</p></div><ShieldCheck className="h-7 w-7 text-primary" /></div><div className="mt-8 grid gap-4 sm:grid-cols-2"><div><p className="text-xs text-white/40">Role</p><p className="mt-1 font-bold">{user.role}</p></div><div><p className="text-xs text-white/40">Status</p><p className="mt-1 font-bold text-primary">{user.status}</p></div><div><p className="text-xs text-white/40">Plan</p><p className="mt-1 font-bold">{typeof user.planId === 'object' && user.planId ? `${user.planId.name} / $${user.planId.price}/${user.planId.billingInterval}` : 'No plan assigned'}</p></div><div><p className="text-xs text-white/40">Joined</p><p className="mt-1 font-bold">{new Date(user.createdAt).toLocaleString()}</p></div></div></section><section className="rounded-2xl border border-red-400/20 bg-red-500/[0.04] p-6 shadow-2xl backdrop-blur-xl"><h3 className="text-lg font-black">Access controls</h3><p className="mt-1 text-sm text-white/50">Suspend or ban this account to prevent access without deleting the user.</p><div className="mt-5 flex flex-wrap gap-3"><button onClick={() => void changeStatus('active')} className="cursor-pointer rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-[#06251b] hover:bg-primary-hover">Activate</button><button onClick={() => void changeStatus('suspended')} className="cursor-pointer rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2.5 text-sm font-bold text-amber-200 hover:bg-amber-500/20">Suspend</button><button onClick={() => void changeStatus('banned')} className="cursor-pointer rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm font-bold text-red-200 hover:bg-red-500/20">Ban</button><button onClick={() => void changeStatus('pending')} className="cursor-pointer rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold text-white/70 hover:bg-white/10">Set pending</button></div></section><section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-xl"><h3 className="text-lg font-black">Plan assignment</h3><p className="mt-1 text-sm text-white/50">Assign an active plan and create a manual subscription record.</p><div className="mt-5 flex flex-wrap gap-3">{plans.map((plan) => <button key={plan._id} onClick={() => void assignPlan(plan._id)} className="cursor-pointer rounded-xl border border-primary/25 bg-primary/10 px-4 py-2.5 text-sm font-bold text-primary hover:bg-primary/20">{plan.name} / ${plan.price}</button>)}</div></section><section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-xl"><h3 className="text-lg font-black">Credit controls</h3><p className="mt-1 text-sm text-white/50">Monthly: {user.credits?.monthly ?? 0} / Bonus: {user.credits?.bonus ?? 0}</p><div className="mt-5 flex flex-wrap gap-3"><input type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} className="w-32 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-primary/60" /><button onClick={() => void changeCredits('add')} className="cursor-pointer rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-[#06251b]">Add credits</button><button onClick={() => void changeCredits('remove')} className="cursor-pointer rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm font-bold text-red-200">Remove</button><button onClick={() => void changeCredits('reset')} className="cursor-pointer rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold text-white/70">Reset</button></div></section></div>;
}
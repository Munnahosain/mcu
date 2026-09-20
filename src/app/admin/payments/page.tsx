'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2, Search, XCircle } from 'lucide-react';

type Payment = { _id: string; paymentId: string; planNameSnapshot: string; amount: number; provider: string; senderNumber: string; transactionId: string; status: string; createdAt: string; userId?: { name?: string; email?: string } };
type Stats = Record<string, { count: number; revenue: number }>;

export default function AdminPaymentsPage() {
  const [status, setStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const params = new URLSearchParams({ status, limit: '50' }); if (search.trim()) params.set('search', search.trim()); if (from) params.set('from', from); if (to) params.set('to', to); const response = await fetch(`/api/admin/payments?${params.toString()}`); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Unable to load payments.'); setPayments(data.payments || []); setStats(data.stats || {}); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load payments.'); }
    finally { setLoading(false); }
  }, [status, search, from, to]);
  useEffect(() => { void load(); }, [load]);

  const review = async (payment: Payment, action: 'approve' | 'reject') => {
    const reason = action === 'reject' ? window.prompt('Rejection reason:') : '';
    if (action === 'reject' && !reason?.trim()) return;
    setBusy(payment._id);
    try { const response = await fetch(`/api/admin/payments/${payment._id}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: action === 'reject' ? JSON.stringify({ reason }) : undefined }); const data = await response.json(); if (!response.ok) throw new Error(data.error || data.message || 'Unable to update payment.'); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update payment.'); }
    finally { setBusy(''); }
  };

  return <div className="mx-auto max-w-7xl space-y-7"><section><p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Finance operations</p><h2 className="mt-2 text-3xl font-black">Payment Verification</h2><p className="mt-2 text-sm text-foreground/65">Review manual bKash submissions before activating plans.</p></section>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4"><p className="text-xs font-semibold text-amber-900/75 dark:text-amber-200/80">Pending Payments</p><p className="mt-2 text-2xl font-black text-amber-900 dark:text-amber-200">{stats.pending?.count || 0}</p></div><div className="rounded-2xl border border-primary/25 bg-primary/10 p-4"><p className="text-xs font-semibold text-emerald-800/75 dark:text-primary/80">Approved Payments</p><p className="mt-2 text-2xl font-black text-emerald-700 dark:text-primary">{stats.approved?.count || 0}</p></div><div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4"><p className="text-xs font-semibold text-red-900/75 dark:text-red-200/80">Rejected Payments</p><p className="mt-2 text-2xl font-black text-red-700 dark:text-red-200">{stats.rejected?.count || 0}</p></div><div className="rounded-2xl border border-foreground/15 bg-foreground/[0.04] p-4"><p className="text-xs font-semibold text-foreground/65">Approved Revenue</p><p className="mt-2 text-2xl font-black text-foreground">৳{(stats.approved?.revenue || 0).toLocaleString()}</p></div></section>
    <div className="flex flex-wrap items-center gap-2">{['pending', 'approved', 'rejected', ''].map((filter) => <button key={filter || 'all'} type="button" onClick={() => setStatus(filter)} className={`rounded-xl border px-4 py-2 text-xs font-bold uppercase tracking-wider ${status === filter ? 'border-primary bg-primary/15 text-primary' : 'border-foreground/15 text-foreground/65 hover:border-primary/40 hover:text-foreground'}`}>{filter || 'all'}</button>)}<Link href="/admin/settings/payment" className="ml-auto rounded-xl border border-primary/40 px-4 py-2 text-xs font-bold text-primary hover:bg-primary/10">Payment Settings</Link></div>
    <div className="grid gap-3 rounded-2xl border border-foreground/15 bg-foreground/[0.04] p-4 md:grid-cols-[minmax(240px,1fr)_160px_160px]"><label className="relative block"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-foreground/45" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search payment, user, TrxID, number" className="w-full rounded-xl border border-foreground/15 bg-background/70 py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-foreground/45 outline-none focus:border-primary" /></label><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="rounded-xl border border-foreground/15 bg-background/70 px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary" aria-label="From date" /><input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="rounded-xl border border-foreground/15 bg-background/70 px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary" aria-label="To date" /></div>
    {error ? <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}
    <div className="overflow-x-auto rounded-2xl border border-foreground/15 bg-background/80 shadow-2xl">{loading ? <div className="flex items-center justify-center p-16 text-primary"><Loader2 className="h-5 w-5 animate-spin" /></div> : <table className="w-full min-w-[1050px] text-left text-sm text-foreground"><thead className="border-b border-foreground/15 text-xs text-foreground/60"><tr><th className="p-4">Payment ID</th><th>User</th><th>Plan</th><th>Amount</th><th>Sender</th><th>Transaction</th><th>Status</th><th>Actions</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment._id} className="border-b border-foreground/10"><td className="p-4 font-semibold">{payment.paymentId}<p className="text-[10px] text-foreground/50">{new Date(payment.createdAt).toLocaleString()}</p></td><td><p>{payment.userId?.name || 'Unknown'}</p><p className="text-xs text-foreground/55">{payment.userId?.email}</p></td><td>{payment.planNameSnapshot}</td><td>৳{payment.amount.toLocaleString()}</td><td>{payment.senderNumber}</td><td className="font-mono text-xs">{payment.transactionId}</td><td><span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">{payment.status}</span></td><td>{payment.status === 'pending' ? <div className="flex gap-2"><button type="button" disabled={Boolean(busy)} onClick={() => void review(payment, 'approve')} className="rounded-lg bg-primary/15 p-2 text-primary" aria-label="Approve payment"><CheckCircle2 className="h-4 w-4" /></button><button type="button" disabled={Boolean(busy)} onClick={() => void review(payment, 'reject')} className="rounded-lg bg-red-500/15 p-2 text-red-500" aria-label="Reject payment"><XCircle className="h-4 w-4" /></button></div> : <span className="text-xs text-foreground/45">Processed</span>}</td></tr>)}</tbody></table>}</div>
  </div>;
}

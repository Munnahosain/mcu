"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Clock3, ShieldCheck, Users } from 'lucide-react';
import { ensureAccessToken } from '@/lib/auth';

type Overview = {
  stats: { totalUsers: number; activeUsers: number; suspendedUsers: number; bannedUsers: number; admins: number };
  recentUsers: Array<{ _id: string; name: string; email: string; role: string; status: string; createdAt: string }>;
};

const cards = [
  ['Total users', 'totalUsers', Users],
  ['Active users', 'activeUsers', CheckCircle2],
  ['Admins & support', 'admins', ShieldCheck],
  ['Suspended / banned', 'suspendedUsers', AlertTriangle],
] as const;

export default function AdminOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    ensureAccessToken().then((token) => fetch('/api/admin/overview', {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }))
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Unable to load admin overview.');
        setData(payload);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load admin overview.'));
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <section>
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">System overview</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Control center</h2>
        <p className="mt-2 max-w-2xl text-sm text-white/55">Monitor account health and administrative access from one server-authorized workspace.</p>
      </section>

      {error ? <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200"><p>{error}</p><Link href="/admin/login" className="mt-3 inline-flex rounded-lg bg-red-500/15 px-3 py-2 text-xs font-bold text-red-100 transition-colors hover:bg-red-500/25">Sign in as Super Admin</Link></div> : null}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, key, Icon]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.045] p-5 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between"><p className="text-xs font-semibold text-white/50">{label}</p><Icon className="h-4 w-4 text-primary" /></div>
            <p className="mt-5 text-3xl font-black">{data ? (key === 'suspendedUsers' ? `${data.stats.suspendedUsers} / ${data.stats.bannedUsers}` : data.stats[key]) : '—'}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl backdrop-blur-xl sm:p-6">
        <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Recent accounts</p><h3 className="mt-1 text-xl font-black">Latest users</h3></div><Clock3 className="h-5 w-5 text-white/35" /></div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm"><thead className="text-xs text-white/40"><tr><th className="pb-3">User</th><th className="pb-3">Role</th><th className="pb-3">Status</th><th className="pb-3">Joined</th></tr></thead><tbody>{data?.recentUsers.map((user) => <tr key={user._id} className="border-t border-white/10"><td className="py-3"><p className="font-semibold">{user.name}</p><p className="text-xs text-white/45">{user.email}</p></td><td className="py-3 text-white/65">{user.role}</td><td className="py-3"><span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">{user.status}</span></td><td className="py-3 text-white/50">{new Date(user.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table>
        </div>
      </section>
    </div>
  );
}
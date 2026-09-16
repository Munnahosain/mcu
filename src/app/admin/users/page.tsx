"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, Users } from 'lucide-react';

type AdminUser = { _id: string; name: string; email: string; role: string; status: string; createdAt: string; credits?: { monthly?: number; bonus?: number; used?: number } };

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setLoading(true);
      const query = search ? `?search=${encodeURIComponent(search)}` : '';
      fetch(`/api/admin/users${query}`, { credentials: 'include' })
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || 'Unable to load users.');
          setUsers(payload.users);
        })
        .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load users.'))
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  return <div className="mx-auto max-w-7xl space-y-6">
    <section className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Directory</p><h2 className="mt-2 text-3xl font-black">Users</h2></div><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users..." className="w-64 rounded-xl border border-white/10 bg-white/[0.05] py-2.5 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-white/35 focus:border-primary/60" /></div></section>
    {error ? <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div> : null}
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] shadow-2xl backdrop-blur-xl"><div className="flex items-center gap-2 border-b border-white/10 p-5 text-sm font-bold"><Users className="h-4 w-4 text-primary" /> Account directory</div><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-white/[0.025] text-xs text-white/40"><tr><th className="px-5 py-3">User</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Credits used</th><th className="px-5 py-3">Joined</th></tr></thead><tbody>{loading ? <tr><td colSpan={5} className="px-5 py-12 text-center text-white/45">Loading users...</td></tr> : users.map((user) => <tr key={user._id} className="border-t border-white/10"><td className="px-5 py-4"><Link href={`/admin/users/${user._id}`} className="font-semibold text-white hover:text-primary">{user.name}</Link><p className="text-xs text-white/45">{user.email}</p></td><td className="px-5 py-4 text-white/65">{user.role}</td><td className="px-5 py-4"><span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">{user.status}</span></td><td className="px-5 py-4 text-white/65">{user.credits?.used ?? 0}</td><td className="px-5 py-4 text-white/45">{new Date(user.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table></div></section>
  </div>;
}
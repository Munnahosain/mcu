"use client";

import Link from 'next/link';
import { Search, Trash2, Users, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type AdminUser = { _id: string; name: string; email: string; role: string; status: string; createdAt: string; credits?: { used?: number } };

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<AdminUser | null>(null);
  const [confirmationText, setConfirmationText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const query = search ? `?search=${encodeURIComponent(search)}` : '';
      const response = await fetch(`/api/admin/users${query}`, { credentials: 'include' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to load users.');
      setUsers(payload.users || []);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load users.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadUsers(), 250);
    return () => window.clearTimeout(timeout);
  }, [loadUsers]);

  const openDeleteDialog = (user: AdminUser) => {
    setError('');
    setConfirmationText('');
    setPendingDelete(user);
  };

  const closeDeleteDialog = () => {
    if (deleting) return;
    setPendingDelete(null);
    setConfirmationText('');
  };

  const deleteUser = async () => {
    if (!pendingDelete || ![pendingDelete.email, pendingDelete.name].includes(confirmationText)) return;
    setDeleting(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/users/${pendingDelete._id}`, { method: 'DELETE', credentials: 'include' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to delete user.');
      setUsers((current) => current.filter((item) => item._id !== pendingDelete._id));
      closeDeleteDialog();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to delete user.');
    } finally {
      setDeleting(false);
    }
  };

  return <div className="mx-auto max-w-7xl space-y-6">
    <section className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Directory</p><h2 className="mt-2 text-3xl font-black">Users</h2></div><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/45" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users..." className="w-64 rounded-xl border border-foreground/15 bg-background py-2.5 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-foreground/40 focus:border-primary/60" /></div></section>
    {error ? <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-200">{error}</div> : null}
    <section className="overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.035] shadow-2xl"><div className="flex items-center gap-2 border-b border-foreground/10 p-5 text-sm font-bold"><Users className="h-4 w-4 text-primary" /> Account directory</div><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-foreground/[0.025] text-xs text-foreground/55"><tr><th className="px-5 py-3">User</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Credits used</th><th className="px-5 py-3">Joined</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody>{loading ? <tr><td colSpan={6} className="px-5 py-12 text-center text-foreground/45">Loading users...</td></tr> : users.map((user) => <tr key={user._id} className="border-t border-foreground/10"><td className="px-5 py-4"><Link href={`/admin/users/${user._id}`} className="font-semibold text-foreground hover:text-primary">{user.name}</Link><p className="text-xs text-foreground/50">{user.email}</p></td><td className="px-5 py-4 text-foreground/65">{user.role}</td><td className="px-5 py-4"><span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">{user.status}</span></td><td className="px-5 py-4 text-foreground/65">{user.credits?.used ?? 0}</td><td className="px-5 py-4 text-foreground/50">{new Date(user.createdAt).toLocaleDateString()}</td><td className="px-5 py-4 text-right"><button type="button" onClick={() => openDeleteDialog(user)} disabled={user.role === 'super_admin'} className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/25 px-2.5 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-35" title={user.role === 'super_admin' ? 'Protected account' : 'Delete user'}><Trash2 className="h-3.5 w-3.5" /> Delete</button></td></tr>)}</tbody></table></div></section>
    {pendingDelete ? <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="delete-user-title"><div className="w-full max-w-lg rounded-2xl border border-red-500/30 bg-background p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-red-600">Permanent deletion</p><h3 id="delete-user-title" className="mt-2 text-xl font-black">Delete user account?</h3></div><button type="button" onClick={closeDeleteDialog} disabled={deleting} className="rounded-lg p-2 text-foreground/55 hover:bg-foreground/10" aria-label="Close delete dialog"><X className="h-5 w-5" /></button></div><p className="mt-4 text-sm text-foreground/70">This permanently deletes the user and their account data. Type or paste the exact email or name to confirm:</p><p className="mt-3 break-all rounded-lg bg-foreground/[0.06] px-3 py-2 text-sm font-bold text-foreground">{pendingDelete.email}</p><input autoFocus value={confirmationText} onChange={(event) => setConfirmationText(event.target.value)} placeholder={pendingDelete.email} className="mt-4 w-full rounded-xl border border-foreground/15 bg-background px-3 py-3 text-sm outline-none focus:border-red-500" /><div className="mt-5 flex justify-end gap-3"><button type="button" onClick={closeDeleteDialog} disabled={deleting} className="rounded-xl border border-foreground/15 px-4 py-2.5 text-sm font-bold hover:bg-foreground/10">Cancel</button><button type="button" onClick={() => void deleteUser()} disabled={deleting || ![pendingDelete.email, pendingDelete.name].includes(confirmationText)} className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold !text-white disabled:cursor-not-allowed disabled:opacity-40">{deleting ? 'Deleting...' : 'Delete permanently'}</button></div></div></div> : null}
  </div>;
}

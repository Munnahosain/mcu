"use client";

import { useEffect, useState } from 'react';
import { Activity, Shield, ShieldAlert, UserCircle } from 'lucide-react';

type SecurityEvent = {
  _id: string;
  type: string;
  action?: string;
  userId?: string | { _id?: string; name?: string; email?: string } | null;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

export default function AdminSecurityPage() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch('/api/admin/security', { credentials: 'include' });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Unable to load security events.');
        setEvents(payload.events || []);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Unable to load security events.');
      }
    };

    void load();
  }, []);

  const formatUser = (userId: SecurityEvent['userId']) => {
    if (!userId) return 'System';
    if (typeof userId === 'string') return userId;
    return userId.name || userId.email || 'Unknown user';
  };

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <section>
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Trust & access</p>
        <h2 className="mt-2 text-3xl font-black">Security</h2>
        <p className="mt-2 text-sm text-white/55">Recent admin activity, access attempts, and account security events.</p>
      </section>

      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between"><p className="text-xs font-semibold text-white/50">Audit stream</p><Activity className="h-4 w-4 text-primary" /></div>
          <p className="mt-5 text-3xl font-black">{events.length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between"><p className="text-xs font-semibold text-white/50">Blocked attempts</p><ShieldAlert className="h-4 w-4 text-red-300" /></div>
          <p className="mt-5 text-3xl font-black">{events.filter((event) => event.type.toLowerCase().includes('denied') || event.type.toLowerCase().includes('failed')).length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between"><p className="text-xs font-semibold text-white/50">Protected access</p><Shield className="h-4 w-4 text-emerald-300" /></div>
          <p className="mt-5 text-3xl font-black">Online</p>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur-xl">
        <div className="space-y-3">
          {events.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-6 text-sm text-white/50">No security events recorded yet.</div>
          ) : (
            events.map((event) => (
              <div key={event._id} className="rounded-xl border border-white/10 bg-black/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <UserCircle className="h-4 w-4 text-primary" />
                    <span className="text-sm font-bold text-white">{event.type}</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">{event.createdAt ? new Date(event.createdAt).toLocaleString() : '—'}</span>
                </div>
                <div className="mt-2 text-sm text-white/60">
                  <p>Actor: {formatUser(event.userId)}</p>
                  <p>IP: {event.ip || 'Unknown'}</p>
                  <p>Action: {String(event.action || (event.metadata && typeof event.metadata.action === 'string' ? event.metadata.action : 'Security event'))}</p>
                  {event.userAgent ? <p>User agent: {event.userAgent}</p> : null}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

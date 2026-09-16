"use client";

import { FormEvent, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { setAccessToken, setAuthUser } from '@/lib/auth';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error('Invalid admin credentials.');
      setAccessToken(data.accessToken);
      setAuthUser({ id: data.user.id, email: data.user.email, name: data.user.name, signedInAt: Date.now() });
      const adminCheck = await fetch('/api/admin/overview', {
        credentials: 'include',
        headers: { Authorization: `Bearer ${data.accessToken}` },
      });
      if (!adminCheck.ok) throw new Error('This account does not have Super Admin access.');
      router.replace('/admin');
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Invalid admin credentials.');
    } finally {
      setLoading(false);
    }
  };

  return <main className="flex min-h-screen items-center justify-center bg-[#06110f] px-4 py-10 text-white"><div className="w-full max-w-md rounded-3xl border border-primary/25 bg-white/[0.05] p-6 shadow-2xl backdrop-blur-xl sm:p-8"><Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-white/50 hover:text-primary"><ArrowLeft className="h-3.5 w-3.5" /> Back to MCUSTOCK</Link><div className="mt-8 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10"><Image src="/MCU-LOGO-0.2V-1.png" alt="MCUSTOCK" width={34} height={34} className="h-8 w-8 object-contain" /></div><p className="mt-5 text-[10px] font-bold uppercase tracking-[0.3em] text-primary">MCUSTOCK</p><h1 className="mt-2 text-2xl font-black">Admin Control Center</h1><p className="mt-2 text-sm text-white/50">Sign in with your authorized administrator account.</p></div>{error ? <div className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-center text-xs font-semibold text-red-200">{error}</div> : null}<form onSubmit={handleSubmit} className="mt-7 space-y-4"><label className="block text-xs font-semibold text-white/60">Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-primary/60" placeholder="admin@example.com" /></label><label className="block text-xs font-semibold text-white/60">Password<div className="relative mt-1.5"><input type={showPassword ? 'text' : 'password'} required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 pr-11 text-sm text-white outline-none placeholder:text-white/30 focus:border-primary/60" placeholder="Your password" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-primary" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></label><button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-[#06251b] transition-colors hover:bg-primary-hover disabled:opacity-50"><ShieldCheck className="h-4 w-4" />{loading ? 'Verifying...' : 'Sign in securely'}</button></form><p className="mt-6 text-center text-[11px] text-white/35">Protected by server-side role authorization.</p></div></main>;
}
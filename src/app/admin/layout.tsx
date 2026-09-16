"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, BarChart3, CreditCard, Flag, Gauge, LayoutDashboard, Settings, Shield, Users } from 'lucide-react';

const navigation = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/plans', label: 'Plans', icon: CreditCard },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/usage', label: 'Usage', icon: Gauge },
  { href: '/admin/features', label: 'Feature flags', icon: Flag },
  { href: '/admin/security', label: 'Security', icon: Shield },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/admin/login') return <div className="admin-login-shell">{children}</div>;

  return (
    <div className="admin-shell min-h-screen bg-[#06110f] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(22,199,132,0.14),transparent_30%),radial-gradient(circle_at_100%_100%,rgba(39,227,154,0.08),transparent_32%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-[1680px]">
        <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-black/10 p-5 lg:block">
          <Link href="/admin" className="mb-8 block rounded-2xl border border-primary/20 bg-white/[0.04] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary/70">MCUSTOCK</p>
            <p className="mt-1 text-lg font-black tracking-tight">Admin Control</p>
          </Link>
          <nav className="space-y-1" aria-label="Admin navigation">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/60 transition-colors hover:bg-primary/10 hover:text-primary">
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-white/10 bg-[#06110f]/80 px-4 backdrop-blur-xl sm:px-8">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-primary/70">Protected workspace</p>
              <h1 className="text-lg font-black tracking-tight sm:text-xl">MCUSTOCK Admin</h1>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
              <Activity className="h-3.5 w-3.5" /> Secure session
            </div>
          </header>
          <nav className="flex gap-2 overflow-x-auto border-b border-white/10 p-3 lg:hidden" aria-label="Admin navigation">
            {navigation.map((item) => <Link key={item.href} href={item.href} className="shrink-0 rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-white/65">{item.label}</Link>)}
          </nav>
          <main className="p-4 sm:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
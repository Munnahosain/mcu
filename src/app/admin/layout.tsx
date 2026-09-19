"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Activity, BarChart3, Coins, CreditCard, Flag, Gauge, LayoutDashboard, Settings, Shield, Users } from 'lucide-react';
import Image from 'next/image';
import ThemeToggle from '@/components/ThemeToggle';
import { ensureAccessToken, getAuthUser } from '@/lib/auth';

const navigation = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/plans', label: 'Plans', icon: CreditCard },
  { href: '/admin/credits', label: 'Credits', icon: Coins },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/usage', label: 'Usage', icon: Gauge },
  { href: '/admin/features', label: 'Feature flags', icon: Flag },
  { href: '/admin/security', label: 'Security', icon: Shield },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

let adminAuthRaw: string | null | undefined;
let adminAuthSnapshot: ReturnType<typeof getAuthUser> = null;

function getAdminAuthSnapshot() {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem('mcustock_user');
  if (raw === adminAuthRaw) return adminAuthSnapshot;
  adminAuthRaw = raw;
  adminAuthSnapshot = getAuthUser();
  return adminAuthSnapshot;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/admin/login';
  const [accessState, setAccessState] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const user = useSyncExternalStore(
    (callback) => {
      window.addEventListener('mcustock-auth-changed', callback);
      window.addEventListener('storage', callback);
      return () => {
        window.removeEventListener('mcustock-auth-changed', callback);
        window.removeEventListener('storage', callback);
      };
    },
    getAdminAuthSnapshot,
    () => null,
  );

  useEffect(() => {
    if (isLoginPage) return;
    let active = true;
    void (async () => {
      const token = await ensureAccessToken();
      if (!token) {
        if (active) setAccessState('denied');
        return;
      }
      const response = await fetch('/api/admin/overview', {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null);
      if (active) setAccessState(response?.ok ? 'allowed' : 'denied');
    })();
    return () => { active = false; };
  }, [isLoginPage]);

  useEffect(() => {
    if (accessState === 'denied') window.location.replace('/dashboard/generator');
  }, [accessState]);

  if (isLoginPage) return <div className="admin-login-shell">{children}</div>;

  if (accessState !== 'allowed') {
    return <div className="flex min-h-screen items-center justify-center bg-[var(--main-bg)] text-primary"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" /></div>;
  }

  const displayName = user?.name || 'admin';
  const initials = displayName.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'AD';

  return (
    <div className="admin-shell min-h-screen bg-[#06110f] text-white" data-admin-theme="adaptive">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(22,199,132,0.14),transparent_30%),radial-gradient(circle_at_100%_100%,rgba(39,227,154,0.08),transparent_32%)]" />
      <div className="relative mx-auto min-h-screen max-w-[1680px]">
        <Link href="/" className="admin-mobile-home-logo fixed left-3 top-3 z-50 flex h-11 w-11 items-center justify-center rounded-2xl lg:hidden" aria-label="MCUSTOCK marketing home" title="MCUSTOCK marketing home">
          <Image src="/MCU-LOGO-0.2V-1.png" alt="MCUSTOCK" width={30} height={30} className="h-7 w-7 object-contain" priority />
        </Link>

        <header className="admin-header sticky top-0 z-20 hidden justify-center px-2 py-2 sm:px-6 sm:py-3 lg:flex">
          <div className="dashboard-topbar admin-topbar flex w-full max-w-full items-center justify-between gap-2 rounded-full bg-[#071b17]/80 p-1.5 px-2 py-1.5 backdrop-blur-2xl sm:w-fit sm:px-3.5 sm:py-1.5 sm:gap-3">
            <Link href="/" className="dashboard-brand group flex shrink-0 items-center gap-2.5 rounded-full px-2 py-2" title="MCUSTOCK marketing home">
              <span className="liquid-icon-shell flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
                <Image src="/MCU-LOGO-0.2V-1.png" alt="MCUSTOCK" width={26} height={26} className="h-5 w-5 object-contain transition-transform duration-500 group-hover:scale-110" priority />
              </span>
              <div className="hidden leading-tight min-[560px]:block">
                <span className="block text-[9px] font-bold uppercase tracking-[0.32em] text-white/40">Stock AI</span>
                <span className="liquid-wordmark text-[15px] font-bold tracking-[0.12em]">MCUSTOCK</span>
              </div>
            </Link>

            <nav className="dashboard-nav-segments hidden min-w-0 max-w-[calc(100vw-15rem)] flex-none items-center gap-1 overflow-x-auto px-1 py-1 lg:flex" aria-label="Admin navigation">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== '/admin' && pathname?.startsWith(`${item.href}/`) === true);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    aria-label={item.label}
                    title={item.label}
                    className={`nav-pill-link relative flex shrink-0 cursor-pointer select-none items-center justify-center rounded-full px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors duration-200 sm:px-3 ${isActive ? 'is-active text-[#dffaf1]' : 'text-foreground/65 hover:text-white'}`}
                  >
                    {isActive ? <span className="nav-active-pill" aria-hidden="true" /> : null}
                    <Icon className={`relative z-10 h-4 w-4 shrink-0 ${isActive ? 'text-[#75f0cb] stroke-[2.4]' : 'text-foreground/60 stroke-[2]'}`} />
                    <span className="collapsible pointer-events-none"><span className="collapsible-inner"><span className="label font-bold text-[10px] uppercase tracking-[0.1em]">{item.label}</span></span></span>
                  </Link>
                );
              })}
            </nav>

            <div className="hidden shrink-0 items-center gap-2 sm:flex">
              <ThemeToggle iconOnly />
              <div className="flex items-center gap-1.5 rounded-full border border-white/40 bg-foreground/[0.03] p-1 pr-2 dark:border-primary/20">
                <span className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-[#27e39a] text-xs font-extrabold text-[#071b17] shadow-sm">
                  {initials}
                  {user?.avatarUrl ? <img src={user.avatarUrl} alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} className="absolute inset-0 h-full w-full object-cover" /> : null}
                </span>
                <span className="hidden max-w-[90px] truncate text-xs font-bold text-foreground md:inline">{displayName}</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
                <Activity className="h-3.5 w-3.5" /> <span className="hidden xl:inline">Secure session</span>
              </div>
            </div>
          </div>
        </header>

        <nav className="dashboard-mobile-nav admin-mobile-nav fixed bottom-0 left-0 right-0 z-50 lg:hidden" aria-label="Admin navigation">
          <div className="dashboard-mobile-nav-inner mx-auto flex max-w-lg items-center gap-1 overflow-x-auto px-2 no-scrollbar">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/admin' && pathname?.startsWith(`${item.href}/`) === true);
              return <div key={item.href} className="shrink-0"><Link href={item.href} aria-current={isActive ? 'page' : undefined} aria-label={item.label} title={item.label} className={`relative flex h-11 w-11 items-center justify-center rounded-full transition-colors ${isActive ? 'text-[#063b2c]' : 'text-foreground/55 hover:text-foreground'}`}>{isActive ? <span className="absolute inset-0 rounded-full bg-primary shadow-[0_4px_14px_rgba(22,199,132,0.3)]" aria-hidden="true" /> : null}<Icon className="relative z-10 h-[18px] w-[18px]" strokeWidth={isActive ? 2.5 : 2} /></Link></div>;
            })}
          </div>
        </nav>

        <main className="min-w-0 p-3 pb-24 sm:p-8 lg:pb-8">{children}</main>
      </div>
    </div>
  );
}
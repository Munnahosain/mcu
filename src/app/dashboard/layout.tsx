"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Sparkles,
  Eraser,
  Box,
  Layout as LayoutIcon,
  Pipette,
  Binary,
  BarChart3,
  Activity,
  Grid3X3,
  Crown,
  LogOut,
  ChevronDown,
  Type,
  Calendar,
  CreditCard,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AuthUser, clearAuthUser, disableGoogleAutoSelect, ensureAccessToken, getAuthUser, refreshAuthSession } from "@/lib/auth";
import ThemeToggle from "@/components/ThemeToggle";
import { GeneratorStateProvider } from "./GeneratorStateContext";
import CreditSummary from "@/components/dashboard/CreditSummary";

const navLinks = [
  { name: "Generator", href: "/dashboard/generator", icon: Sparkles },
  { name: "3D Studio", href: "/dashboard/3d-icon-studio", icon: Box },
  { name: "BG Remover", href: "/dashboard/bg-remover", icon: Eraser },
  { name: "Bento", href: "/dashboard/bento", icon: LayoutIcon },
  { name: "Grid", href: "/dashboard/grid-generator", icon: Grid3X3 },
  { name: "Trading", href: "/dashboard/trading", icon: Activity },
  { name: "Palette", href: "/dashboard/palette", icon: Pipette },
  { name: "Typebox", href: "/dashboard/typebox", icon: Type },
  { name: "ASCII", href: "/dashboard/ascii", icon: Binary },
  { name: "Events", href: "/dashboard/events", icon: Calendar },
  { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "Pricing", href: "/dashboard/pricing", icon: Crown },
];

function getInitials(nameOrEmail: string): string {
  if (!nameOrEmail) return "MC";
  const parts = nameOrEmail.trim().split(/[\s@._-]+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return nameOrEmail.slice(0, 2).toUpperCase();
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNavCompact, setIsNavCompact] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      const token = await ensureAccessToken();
      if (cancelled) return;

      let storedUser = getAuthUser();
      if (token && storedUser && !storedUser.avatarUrl) {
        const refreshedUser = await refreshAuthSession();
        if (refreshedUser) storedUser = { ...refreshedUser, signedInAt: Date.now() };
      }
      if (!token || !storedUser) {
        clearAuthUser();
        setUser(null);
      } else {
        setUser(storedUser);
      }
      setIsHydrated(true);
    };

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    if (!user) {
      router.replace("/login");
    }
  }, [isHydrated, router, user]);

  useEffect(() => {
    const handleScroll = () => setIsNavCompact(window.scrollY > 80);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close popovers on route change
  useEffect(() => {
    const closeMenus = window.setTimeout(() => {
      setIsProfileOpen(false);
    }, 0);
    return () => window.clearTimeout(closeMenus);
  }, [pathname]);

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => undefined);
    disableGoogleAutoSelect();
    clearAuthUser();
    setUser(null);
    window.dispatchEvent(new Event("mcustock-auth-changed"));
    router.replace("/login");
  };

  if (!isHydrated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--main-bg)] text-primary">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
      </div>
    );
  }

  const userInitials = getInitials(user.name || user.email || "mcu");

  return (
    <GeneratorStateProvider>
      <div className="relative min-h-screen w-full flex flex-col bg-[var(--main-bg)] text-foreground selection:bg-primary selection:text-white">
        <Link
          href="/"
          className="dashboard-mobile-home-logo fixed left-3 top-3 z-50 flex h-12 w-12 items-center justify-center rounded-2xl"
          aria-label="Go to MCUSTOCK home"
          title="MCUSTOCK home"
        >
          <Image
            src="/MCU-LOGO-0.2V-1.png"
            alt="MCUSTOCK"
            width={36}
            height={36}
            className="h-9 w-9 object-contain"
            priority
          />
        </Link>

        {/* Subtle Ambient Aurora Background Glow */}
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          <div className="absolute left-[15%] top-[-8%] h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(circle,rgba(22,199,132,0.06)_0%,transparent_70%)] blur-3xl" />
          <div className="absolute right-[10%] top-[20%] h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(circle,rgba(39,227,154,0.04)_0%,transparent_70%)] blur-3xl" />
        </div>

        {/* 1. TOP STICKY ALWAYS-VISIBLE LIQUID GLASS NAVBAR */}
        <header className="sticky top-0 z-50 relative hidden w-full px-2 py-2 sm:px-6 sm:py-3 pointer-events-none lg:flex justify-center">
          <div
            className={`dashboard-topbar pointer-events-auto flex items-center rounded-full bg-[#071b17]/78 p-1.5 w-full max-w-fit justify-center gap-2 sm:gap-3 px-3.5 py-1.5 ${isNavCompact ? "compact" : ""}`}
            style={{
              backdropFilter: "blur(24px) saturate(1.2)",
              WebkitBackdropFilter: "blur(24px) saturate(1.2)",
              isolation: "isolate",
            }}
          >
            {/* Left: Brand Logo & Title */}
            <Link
              href="/"
              className="dashboard-brand group flex items-center gap-2.5 rounded-full px-2 py-2 transition-opacity duration-150 shrink-0"
              title="MCUSTOCK AI Home"
            >
              <span className="liquid-icon-shell flex h-9 w-9 items-center justify-center rounded-xl shrink-0">
                <Image
                  src="/MCU-LOGO-0.2V-1.png"
                  alt="MCUSTOCK Logo"
                  width={26}
                  height={26}
                  className="h-5 w-5 object-contain transition-transform duration-500 group-hover:scale-110"
                  priority
                />
              </span>
              <div className="hidden min-[520px]:block leading-tight select-none">
                <span className="block text-[9px] font-bold uppercase tracking-[0.38em] text-white/40">
                  Stock Creator AI
                </span>
                <span className="liquid-wordmark text-[15px] font-bold tracking-[0.15em]">
                  MCUSTOCK
                </span>
              </div>
            </Link>

            {/* Center: Dynamic Morphing Horizontal Navigation (Icons only on scroll down, Name at top / scroll up) */}
            <nav className="dashboard-nav-segments hidden lg:flex items-center gap-1 overflow-x-auto no-scrollbar py-1 px-1 relative z-10 pointer-events-auto">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive =
                    pathname === link.href ||
                    (link.href === "/dashboard/generator" && pathname === "/dashboard");

                  return (
                    <Link
                      key={link.name}
                      href={link.href}
                      scroll={false}
                      onMouseEnter={() => router.prefetch(link.href)}
                      onFocus={() => router.prefetch(link.href)}
                      aria-current={isActive ? "page" : undefined}
                      aria-label={link.name}
                      title={link.name}
                      className={`nav-pill-link relative flex items-center justify-center rounded-full text-[11px] font-semibold tracking-[0.08em] uppercase transition-colors duration-200 ease-linear whitespace-nowrap shrink-0 cursor-pointer select-none pointer-events-auto px-2.5 py-2 sm:px-3 ${
                        isActive
                          ? "is-active text-[#dffaf1]"
                          : "text-foreground/65 hover:text-white"
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="dashboard-nav-active-pill-desktop"
                          className="nav-active-pill"
                          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                          aria-hidden="true"
                        />
                      )}
                      <Icon
                        className={`h-4 w-4 relative z-10 transition-colors shrink-0 pointer-events-none ${
                          isActive
                            ? "text-[#75f0cb] stroke-[2.4]"
                            : "text-foreground/60 stroke-[2]"
                        }`}
                      />
                      <div className="collapsible pointer-events-none">
                        <div className="collapsible-inner pointer-events-none">
                          <span className="label font-bold text-[10px] uppercase tracking-[0.12em] pointer-events-none">{link.name}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
            </nav>

            {/* Right: Theme Toggle, Profile Pill (2 Short Letters), Sign Out (Snugly attached) */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Theme Toggle */}
              <div className="hidden sm:flex items-center justify-center">
                <ThemeToggle iconOnly />
              </div>

              {/* User Profile Pill & Dropdown */}
              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className={`flex items-center gap-1.5 rounded-full border-none outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 ring-0 hover:ring-0 active:ring-0 bg-foreground/[0.03] hover:bg-foreground/[0.07] p-1 pr-2 transition-all duration-150 active:scale-95 ${isProfileOpen ? "bg-primary/10" : ""
                    }`}
                  aria-label="User profile menu"
                >
                  {/* 2-Letter Avatar Badge */}
                  <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[#27e39a] text-[#071b17] font-extrabold text-xs shadow-sm ring-2 ring-white/50 dark:ring-[#071b17]/80 shrink-0">
                    <span className="text-[#071b17] font-extrabold tracking-tight">{userInitials}</span>
                    {user.avatarUrl ? <img src={user.avatarUrl} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} className="absolute inset-0 h-full w-full rounded-full object-cover" /> : null}
                    <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-400 ring-1 ring-white dark:ring-[#071b17]" />
                  </span>

                  <div className="hidden md:flex items-center gap-1 overflow-hidden whitespace-nowrap">
                    <span className="max-w-[75px] truncate text-xs font-bold text-foreground">
                      {user.name || "mcu"}
                    </span>
                    <ChevronDown
                      className={`h-3 w-3 text-foreground/50 transition-transform duration-200 ${isProfileOpen ? "rotate-180 text-primary" : ""
                        }`}
                    />
                  </div>
                </button>

                {/* Profile Popover Dropdown */}
                <AnimatePresence>
                  {isProfileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.96 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className="absolute right-0 mt-2.5 w-60 rounded-3xl border border-white/50 dark:border-[rgba(22,199,132,0.2)] bg-white/95 dark:bg-[#071713]/95 p-3 shadow-2xl backdrop-blur-2xl z-50 text-foreground"
                    >
                      {/* User Info Header */}
                      <div className="flex items-center gap-3 p-1.5 border-b border-foreground/[0.08] pb-2.5 mb-2">
                        <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-[#27e39a] text-[#071b17] font-extrabold text-xs shadow shrink-0">
                          {userInitials}
                          {user.avatarUrl ? <img src={user.avatarUrl} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} className="absolute inset-0 h-full w-full object-cover" /> : null}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-extrabold text-foreground">
                            {user.name || "mcu"}
                          </p>
                          <p className="truncate text-[10px] font-medium text-foreground/60">
                            {user.email}
                          </p>
                        </div>
                      </div>

                      <CreditSummary compact />

                      {/* Quick Pro Plan Badge */}
                      <div className="space-y-1">
                        <Link
                          href="/dashboard/pricing"
                          onClick={() => setIsProfileOpen(false)}
                          className="flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-bold text-foreground/80 hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <Crown className="h-3.5 w-3.5 text-primary" /> Pricing &amp; Plans
                          </span>
                        </Link>
                        <Link
                          href="/dashboard/billing"
                          onClick={() => setIsProfileOpen(false)}
                          className="flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-bold text-foreground/80 hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <CreditCard className="h-3.5 w-3.5 text-primary" /> Billing &amp; Usage
                          </span>
                        </Link>
                        <div className="sm:hidden px-2.5 py-1.5 flex items-center justify-between">
                          <span className="text-xs font-bold text-foreground/80">Theme</span>
                          <ThemeToggle />
                        </div>
                      </div>

                      {/* Sign Out inside Dropdown */}
                      <div className="mt-2 pt-2 border-t border-foreground/[0.08]">
                        <button
                          type="button"
                          onClick={handleSignOut}
                          className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-bold text-red-500 hover:bg-red-500/10 transition-colors"
                        >
                          <LogOut className="h-3.5 w-3.5 shrink-0" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Direct Sign Out Button */}
              <button
                type="button"
                onClick={handleSignOut}
                className="hidden sm:flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-white/40 dark:border-red-500/20 bg-foreground/[0.02] text-foreground/60 hover:text-red-500 hover:bg-red-500/10 transition-colors duration-150"
                title="Sign Out"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>

            </div>
          </div>
        </header>

        <nav
          className="dashboard-mobile-nav fixed bottom-0 left-0 right-0 z-50 lg:hidden"
          aria-label="Mobile navigation"
          style={{
            backdropFilter: "blur(24px) saturate(1.2)",
            WebkitBackdropFilter: "blur(24px) saturate(1.2)",
            isolation: "isolate",
          }}
        >
          <div className="dashboard-mobile-nav-inner mx-auto flex max-w-lg items-center gap-1 overflow-x-auto px-2 no-scrollbar">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href || (link.href === "/dashboard/generator" && pathname === "/dashboard");

              return (
                <motion.div key={link.name} whileTap={{ scale: 0.88 }} className="shrink-0">
                  <Link
                    href={link.href}
                    scroll={false}
                    onMouseEnter={() => router.prefetch(link.href)}
                    aria-current={isActive ? "page" : undefined}
                    aria-label={link.name}
                    title={link.name}
                    className={`relative flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-200 ${isActive ? "text-[#063b2c]" : "text-foreground/55 hover:text-foreground"}`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="dashboard-nav-active-pill-mobile"
                        className="absolute inset-0 rounded-full bg-primary shadow-[0_4px_14px_rgba(22,199,132,0.3)]"
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                        aria-hidden="true"
                      />
                    )}
                    <Icon className="relative z-10 h-[18px] w-[18px]" strokeWidth={isActive ? 2.5 : 2} />
                  </Link>
                </motion.div>
              );
            })}
            <motion.button
              type="button"
              whileTap={{ scale: 0.88 }}
              onClick={handleSignOut}
              className="flex h-10 shrink-0 items-center justify-center gap-1 rounded-2xl px-2 text-foreground/55 transition-colors hover:bg-red-500/10 hover:text-red-500"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-[18px] w-[18px]" />
              <span className="text-[9px] font-semibold uppercase tracking-wide">Logout</span>
            </motion.button>
          </div>
        </nav>

        {/* 2. FULL-WIDTH WORKSPACE CONTENT */}
        <main className="flex-1 w-full min-w-0 bg-transparent relative z-10 px-3 py-2 pb-20 sm:px-6 sm:py-4 lg:pb-4">
          <div className="mx-auto w-full max-w-[1920px]">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="w-full"
            >
              {children}
            </motion.div>
          </div>
        </main>
      </div>
    </GeneratorStateProvider>
  );
}

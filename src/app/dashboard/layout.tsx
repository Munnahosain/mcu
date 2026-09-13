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
  Menu,
  X,
  Calendar,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AuthUser, clearAuthUser, ensureAccessToken, getAuthUser } from "@/lib/auth";
import ThemeToggle from "@/components/ThemeToggle";
import { GeneratorStateProvider } from "./GeneratorStateContext";

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      const token = await ensureAccessToken();
      if (cancelled) return;

      const storedUser = getAuthUser();
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

  // Close mobile menu on route change
  useEffect(() => {
    const closeMenus = window.setTimeout(() => {
      setIsMobileMenuOpen(false);
      setIsProfileOpen(false);
    }, 0);
    return () => window.clearTimeout(closeMenus);
  }, [pathname]);

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => undefined);
    clearAuthUser();
    setUser(null);
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
        {/* Subtle Ambient Aurora Background Glow */}
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          <div className="absolute left-[15%] top-[-8%] h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(circle,rgba(22,199,132,0.06)_0%,transparent_70%)] blur-3xl" />
          <div className="absolute right-[10%] top-[20%] h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(circle,rgba(39,227,154,0.04)_0%,transparent_70%)] blur-3xl" />
        </div>

        {/* 1. TOP STICKY ALWAYS-VISIBLE LIQUID GLASS NAVBAR */}
        <header className="sticky top-0 z-50 w-full px-2 py-2 sm:px-6 sm:py-3 pointer-events-none flex justify-center">
          <div
            className={`dashboard-topbar pointer-events-auto flex items-center rounded-full border border-[#1e4b44] bg-[#071b17]/78 p-1.5 shadow-[0_0_0_1px_rgba(18,79,70,0.55)] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] compact w-auto max-w-fit justify-center gap-2 sm:gap-3 px-3.5 py-1.5`}
          >
            {/* Left: Brand Logo & Title */}
            <Link
              href="/"
              className="dashboard-brand flex items-center gap-2 rounded-full px-2 py-1 transition-opacity duration-150 shrink-0"
              title="MCUSTOCK AI Home"
            >
              <span className="liquid-icon-shell flex h-8 w-8 items-center justify-center rounded-2xl shrink-0">
                <Image
                  src="/MCU-LOGO-0.2V-1.png"
                  alt="MCUSTOCK Logo"
                  width={22}
                  height={22}
                  className="h-4.5 w-4.5 object-contain"
                  priority
                />
              </span>
              <div className="hidden min-[520px]:block leading-tight select-none">
                <span className="block text-[8px] font-extrabold uppercase tracking-[0.24em] text-primary/70">
                  Stock AI
                </span>
                <span className="text-[13px] font-extrabold tracking-tight text-foreground">
                  MCU<span className="text-primary">STOCK</span>
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
                  className={`flex items-center gap-1.5 rounded-full border border-white/40 dark:border-primary/20 bg-foreground/[0.03] hover:bg-foreground/[0.06] p-1 pr-2 transition-all duration-150 active:scale-95 ${isProfileOpen ? "ring-2 ring-primary/40 bg-primary/10" : ""
                    }`}
                  aria-label="User profile menu"
                >
                  {/* 2-Letter Avatar Badge */}
                  <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[#27e39a] text-[#071b17] font-extrabold text-xs shadow-sm ring-2 ring-white/50 dark:ring-[#071b17]/80 shrink-0">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt=""
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-[#071b17] font-extrabold tracking-tight">
                        {userInitials}
                      </span>
                    )}
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
                        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[#27e39a] text-[#071b17] font-extrabold text-xs shadow shrink-0">
                          {userInitials}
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

                      {/* Quick Pro Plan Badge */}
                      <div className="space-y-1">
                        <Link
                          href="/dashboard/pricing"
                          onClick={() => setIsProfileOpen(false)}
                          className="flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-bold text-foreground/80 hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <Crown className="h-3.5 w-3.5 text-primary" /> Pro Plan
                          </span>
                          <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[9px] font-extrabold text-primary">
                            Active
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

              {/* Mobile Menu Toggle */}
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-white/40 dark:border-primary/20 bg-foreground/[0.03] text-foreground/80 hover:text-primary transition-colors duration-150"
                aria-label="Toggle navigation menu"
              >
                {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Mobile Navigation Drawer */}
          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="lg:hidden mt-2 overflow-hidden rounded-3xl border border-white/50 dark:border-[rgba(22,199,132,0.2)] bg-white/95 dark:bg-[#071713]/95 p-3 shadow-2xl backdrop-blur-2xl"
              >
                <div className="grid grid-cols-2 gap-1.5">
                  {navLinks.map((link) => {
                    const Icon = link.icon;
                    const isActive =
                      pathname === link.href ||
                      (link.href === "/dashboard/generator" && pathname === "/dashboard");

                    return (
                      <Link
                        key={link.name}
                        href={link.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`flex items-center gap-2 rounded-2xl p-2.5 text-xs font-bold transition-all ${isActive
                            ? "bg-primary/20 text-primary border border-primary/30"
                            : "bg-foreground/[0.02] text-foreground/75 hover:bg-foreground/[0.06] hover:text-foreground"
                          }`}
                      >
                        <Icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-foreground/50"}`} />
                        <span>{link.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        {/* 2. FULL-WIDTH WORKSPACE CONTENT */}
        <main className="flex-1 w-full min-w-0 bg-transparent relative z-10 px-3 py-2 sm:px-6 sm:py-4">
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

"use client";

import {
  ArrowRight,
  BadgeDollarSign,
  FileText,
  LogIn,
  LogOut,
  Sparkles,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { motion } from "framer-motion";
import ThemeToggle from "./ThemeToggle";
import { clearAuthUser, ensureAccessToken, getAuthUser } from "@/lib/auth";

type MarketingChromeProps = {
  activePath?: "/" | "/tools" | "/pricing" | "/docs";
};

const NAV_ITEMS: Array<{
  href: string;
  label: string;
  match: "/" | "/tools" | "/pricing" | "/docs";
  icon: LucideIcon;
}> = [
  { href: "/#features", label: "Features", match: "/", icon: Sparkles },
  { href: "/pricing", label: "Pricing", match: "/pricing", icon: BadgeDollarSign },
  { href: "/docs", label: "Docs", match: "/docs", icon: FileText },
];

const AUTH_EVENT = "mcustock-auth-changed";

function subscribeToAuth(callback: () => void) {
  window.addEventListener(AUTH_EVENT, callback);
  return () => window.removeEventListener(AUTH_EVENT, callback);
}

function getClientAuthSnapshot() {
  return Boolean(getAuthUser());
}

function getServerAuthSnapshot() {
  return false;
}

export default function MarketingChrome({
  activePath = "/",
}: MarketingChromeProps) {
  const router = useRouter();
  const [isCompact, setIsCompact] = useState(false);
  const [displayPath, setDisplayPath] = useState(activePath);
  const isAuthenticated = useSyncExternalStore(
    subscribeToAuth,
    getClientAuthSnapshot,
    getServerAuthSnapshot,
  );

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      const token = await ensureAccessToken();
      if (cancelled) return;

      if (token && getAuthUser()) {
        window.dispatchEvent(new Event(AUTH_EVENT));
      } else {
        clearAuthUser();
        window.dispatchEvent(new Event(AUTH_EVENT));
      }
    };

    void checkSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => undefined);
    clearAuthUser();
    window.dispatchEvent(new Event(AUTH_EVENT));
  };

  const prefetchRoute = (href: string) => {
    router.prefetch(href.split("#")[0]);
  };

  useEffect(() => {
    setDisplayPath(activePath);
  }, [activePath]);

  useEffect(() => {
    const handleScroll = () => {
      setIsCompact(window.scrollY > 80);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <nav className={`liquid-nav fixed inset-x-0 top-0 z-50 hidden lg:block ${isCompact ? "is-compact" : ""}`}>
      <div className="mx-auto flex w-full max-w-7xl flex-col px-4 pt-3 sm:px-6 sm:pt-4 lg:px-8">
        <div
          className="liquid-nav-shell mx-auto grid w-fit max-w-full min-w-0 grid-cols-[auto_auto_auto] min-h-[68px] items-center gap-3 px-3 py-2 sm:min-h-[76px] sm:px-6"
          style={{
            backdropFilter: "blur(24px) saturate(1.2)",
            WebkitBackdropFilter: "blur(24px) saturate(1.2)",
            isolation: "isolate",
          }}
        >
          {/* Brand */}
          <Link
            href="/"
            className="liquid-brand group flex min-w-0 items-center gap-2.5 rounded-full px-2 py-2 sm:gap-3 sm:px-3"
          >
            <span className="liquid-icon-shell h-9 w-9 rounded-xl sm:h-10 sm:w-10">
              <Image
                src="/MCU-LOGO-0.2V-1.png"
                alt="MCU Logo"
                width={26}
                height={26}
                className="h-5 w-5 object-contain transition-transform duration-500 group-hover:scale-110 sm:h-6 sm:w-6"
              />
            </span>
            <span className="hidden sm:block">
              <span className="block text-[9px] font-bold uppercase tracking-[0.38em] text-white/40">
                Stock Creator AI
              </span>
              <span className="liquid-wordmark text-[15px] font-bold tracking-[0.15em]">
                MCUSTOCK
              </span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="desktop-nav hidden items-center lg:flex">
            <div className="nav-segment-shell">
              {NAV_ITEMS.map((item) => {
                const isActive = displayPath === item.match;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => {
                      setDisplayPath(item.match);
                    }}
                    onMouseEnter={() => prefetchRoute(item.href)}
                    onFocus={() => prefetchRoute(item.href)}
                    className={`liquid-nav-link nav-item text-sm font-medium ${isActive ? "is-active" : ""}`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="marketing-nav-active-pill-desktop"
                        className="nav-active-pill"
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        aria-hidden="true"
                      />
                    )}
                    <span className="nav-icon" aria-hidden="true">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="nav-label">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 sm:gap-3">
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>
            {isAuthenticated ? (
              <>
                <button type="button" onClick={() => void handleLogout()} className="liquid-nav-link hidden text-sm md:inline-flex">
                  Log out
                </button>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="liquid-nav-link inline-flex h-9 w-9 justify-center p-0 md:hidden"
                  aria-label="Log out"
                  title="Log out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
                <Link href="/dashboard/generator" className="liquid-button-primary inline-flex text-sm">
                  Open App
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="liquid-nav-link hidden whitespace-nowrap text-sm md:inline-flex">
                  Log in
                </Link>
                <Link href="/signup" className="liquid-button-primary inline-flex whitespace-nowrap px-3 text-xs sm:px-6 sm:text-sm">
                  Start Free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Mobile Nav Row */}
        <div
          className="liquid-nav-mobile-row mt-2 hidden items-center gap-1.5 overflow-x-auto px-2 lg:hidden"
          style={{
            backdropFilter: "blur(24px) saturate(1.2)",
            WebkitBackdropFilter: "blur(24px) saturate(1.2)",
            isolation: "isolate",
          }}
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activePath === item.match;
            return (
              <Link
                key={item.label}
                href={item.href}
                onMouseEnter={() => prefetchRoute(item.href)}
                onFocus={() => prefetchRoute(item.href)}
                className={`liquid-nav-link shrink-0 text-sm ${isActive ? "is-active" : ""}`}
              >
                <span>{item.label}</span>
                <Zap className="h-3 w-3 opacity-50" />
              </Link>
            );
          })}
          {isAuthenticated ? (
            <Link href="/dashboard/generator" className="liquid-nav-link shrink-0 text-sm md:hidden">
              Open App
            </Link>
          ) : (
            <Link href="/login" className="liquid-nav-link shrink-0 text-sm md:hidden">
              Log in
            </Link>
          )}
          <div className="shrink-0 sm:hidden">
            <ThemeToggle iconOnly />
          </div>
        </div>
      </div>
      </nav>

      <nav className="marketing-mobile-nav fixed bottom-0 left-0 right-0 z-50 lg:hidden" aria-label="Mobile marketing navigation">
      <div className="marketing-mobile-nav-inner mx-auto flex max-w-sm items-center justify-center gap-1 overflow-x-auto px-2 no-scrollbar">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = displayPath === item.match;

          return (
            <motion.div key={item.label} whileTap={{ scale: 0.88 }} className="shrink-0">
              <Link
                href={item.href}
                onMouseEnter={() => prefetchRoute(item.href)}
                aria-label={item.label}
                title={item.label}
                className={`relative flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-200 ${isActive ? "text-[#063b2c]" : "text-foreground/55 hover:text-foreground"}`}
              >
                {isActive && (
                  <motion.span
                    layoutId="marketing-nav-active-pill-mobile"
                    className="absolute inset-0 rounded-full bg-primary shadow-[0_4px_14px_rgba(22,199,132,0.3)]"
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    aria-hidden="true"
                  />
                )}
                <Icon className="relative z-10 h-[18px] w-[18px]" strokeWidth={isActive ? 2.5 : 2} />
              </Link>
            </motion.div>
          );
        })}
        {isAuthenticated ? (
          <>
            <Link href="/dashboard/generator" aria-label="Open app" title="Open app" className="marketing-mobile-action">
              <ArrowRight className="h-[17px] w-[17px]" />
            </Link>
            <button type="button" onClick={() => void handleLogout()} aria-label="Log out" title="Log out" className="marketing-mobile-action">
              <LogOut className="h-[17px] w-[17px]" />
            </button>
          </>
        ) : (
          <Link href="/login" aria-label="Log in" title="Log in" className="marketing-mobile-action">
            <LogIn className="h-[17px] w-[17px]" />
          </Link>
        )}
        <ThemeToggle iconOnly />
      </div>
      </nav>
    </>
  );
}

"use client";

import {
  ArrowRight,
  BadgeDollarSign,
  FileText,
  Sparkles,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

export default function MarketingChrome({
  activePath = "/",
}: MarketingChromeProps) {
  const router = useRouter();
  const [isCompact, setIsCompact] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      const token = await ensureAccessToken();
      if (cancelled) return;

      if (token && getAuthUser()) {
        setIsAuthenticated(true);
      } else {
        clearAuthUser();
        setIsAuthenticated(false);
      }
      setAuthChecked(true);
    };

    void checkSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => undefined);
    clearAuthUser();
    setIsAuthenticated(false);
  };

  const prefetchRoute = (href: string) => {
    router.prefetch(href.split("#")[0]);
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsCompact(window.scrollY > 80);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className={`liquid-nav fixed inset-x-0 top-0 z-50 ${isCompact ? "is-compact" : ""}`}>
      <div className="mx-auto flex w-full max-w-7xl flex-col px-4 pt-3 sm:px-6 sm:pt-4 lg:px-8">
        <div className="liquid-nav-shell grid grid-cols-[1fr_auto_1fr] min-h-[68px] items-center px-4 py-2 sm:min-h-[76px] sm:px-6">
          {/* Brand */}
          <Link
            href="/"
            className="liquid-brand group flex items-center gap-2.5 rounded-full px-2 py-2 sm:gap-3 sm:px-3"
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
                const isActive = activePath === item.match;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onMouseEnter={() => prefetchRoute(item.href)}
                    onFocus={() => prefetchRoute(item.href)}
                    className={`liquid-nav-link nav-item text-sm font-medium ${isActive ? "is-active" : ""}`}
                  >
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
            {authChecked && isAuthenticated ? (
              <>
                <button type="button" onClick={() => void handleLogout()} className="liquid-nav-link hidden text-sm md:inline-flex">
                  Log out
                </button>
                <Link href="/dashboard/generator" className="liquid-button-primary inline-flex text-sm">
                  Open App
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="liquid-nav-link hidden text-sm md:inline-flex">
                  Log in
                </Link>
                <Link href="/signup" className="liquid-button-primary inline-flex text-sm">
                  Start Free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Mobile Nav Row */}
        <div className="liquid-nav-mobile-row mt-2 flex items-center gap-1.5 overflow-x-auto px-2 pb-2 lg:hidden">
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
          {authChecked && isAuthenticated ? (
            <Link href="/dashboard/generator" className="liquid-nav-link shrink-0 text-sm md:hidden">
              Open App
            </Link>
          ) : (
            <Link href="/login" className="liquid-nav-link shrink-0 text-sm md:hidden">
              Log in
            </Link>
          )}
          <div className="shrink-0 sm:hidden">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </nav>
  );
}

"use client";

import { ArrowRight, Zap } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

type MarketingChromeProps = {
  activePath?: "/" | "/tools" | "/pricing" | "/docs";
};

const NAV_ITEMS = [
  { href: "/#features", label: "Features", match: "/" },
  { href: "/tools", label: "Tools", match: "/tools" },
  { href: "/pricing", label: "Pricing", match: "/pricing" },
  { href: "/docs", label: "Docs", match: "/docs" },
] as const;

export default function MarketingChrome({
  activePath = "/",
}: MarketingChromeProps) {
  return (
    <nav className="liquid-nav fixed inset-x-0 top-0 z-50">
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
          <div className="hidden items-center gap-1 lg:flex">
            {NAV_ITEMS.map((item) => {
              const isActive = activePath === item.match;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`liquid-nav-link text-sm font-medium ${isActive ? "is-active" : ""}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 sm:gap-3">
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>
            <Link href="/login" className="liquid-nav-link hidden text-sm md:inline-flex">
              Log in
            </Link>
            <Link href="/signup" className="liquid-button-primary inline-flex text-sm">
              Start Free
              <ArrowRight className="h-4 w-4" />
            </Link>
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
                className={`liquid-nav-link shrink-0 text-sm ${isActive ? "is-active" : ""}`}
              >
                <span>{item.label}</span>
                <Zap className="h-3 w-3 opacity-50" />
              </Link>
            );
          })}
          <Link href="/login" className="liquid-nav-link shrink-0 text-sm md:hidden">
            Log in
          </Link>
          <div className="shrink-0 sm:hidden">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </nav>
  );
}

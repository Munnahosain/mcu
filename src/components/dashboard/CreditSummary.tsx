"use client";

import { useEffect, useState, useCallback } from "react";
import { CalendarClock, Coins, Gauge, RefreshCw } from "lucide-react";
import { ensureAccessToken } from "@/lib/auth";

type CreditSummaryData = {
  credits: { monthly: number; bonus: number; used: number; remaining: number; total: number };
  subscription: { expiresAt?: string | null } | null;
};

type CreditSummaryProps = {
  compact?: boolean;
};

function getExpiryLabel(expiresAt?: string | null) {
  if (!expiresAt) return "No expiry set";

  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return "No expiry set";

  const msLeft = expiry.getTime() - Date.now();
  const diffDays = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

  if (msLeft <= 0) return "Expired";
  if (diffDays === 0) return "Expires today";
  if (diffDays < 30) return `Expires in ${diffDays} day${diffDays === 1 ? "" : "s"}`;

  return `Expires ${expiry.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

// Module-level cache so the credit data is available immediately across dropdown opens
let cachedCreditData: CreditSummaryData | null = null;

export default function CreditSummary({ compact = false }: CreditSummaryProps) {
  const [data, setData] = useState<CreditSummaryData | null>(cachedCreditData);
  const [loading, setLoading] = useState(!cachedCreditData);
  const [hasError, setHasError] = useState(false);

  const fetchCredits = useCallback(async () => {
    try {
      const token = await ensureAccessToken();
      const response = await fetch("/api/account/credits", {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!response.ok) {
        setHasError(true);
        return;
      }

      const payload = (await response.json()) as CreditSummaryData;
      cachedCreditData = payload;
      setData(payload);
      setHasError(false);
    } catch {
      setHasError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCredits();

    // Listen for custom credit update events triggered after generation or admin changes
    const handleUpdate = () => {
      void fetchCredits();
    };

    window.addEventListener("mcustock:credits-updated", handleUpdate);
    return () => {
      window.removeEventListener("mcustock:credits-updated", handleUpdate);
    };
  }, [fetchCredits]);

  if (!data) {
    if (compact) {
      if (hasError) {
        return (
          <div className="my-2 mx-1 rounded-xl border border-foreground/[0.08] bg-foreground/[0.035] px-2.5 py-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/55">Credits</span>
              <button
                type="button"
                onClick={() => { setLoading(true); void fetchCredits(); }}
                className="flex items-center gap-1 text-[10px] font-bold text-primary hover:underline"
              >
                <RefreshCw className="h-2.5 w-2.5" /> Retry
              </button>
            </div>
            <p className="mt-1 text-[10px] text-foreground/50">Unable to load credits</p>
          </div>
        );
      }

      if (loading) {
        return (
          <div className="my-2 mx-1 animate-pulse rounded-xl border border-foreground/[0.08] bg-foreground/[0.035] px-2.5 py-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/55">Credits</span>
              <div className="h-3 w-14 rounded bg-foreground/10" />
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/10" />
            <div className="mt-2 flex justify-between gap-2">
              <div className="h-2.5 w-12 rounded bg-foreground/10" />
              <div className="h-2.5 w-16 rounded bg-foreground/10" />
            </div>
          </div>
        );
      }
    }
    return null;
  }

  const { credits } = data;
  const usedPercent = credits.total > 0 ? Math.min((credits.used / credits.total) * 100, 100) : 0;
  const expiry = getExpiryLabel(data.subscription?.expiresAt);

  if (compact) {
    return (
      <div className="my-2 mx-1 rounded-xl border border-foreground/[0.08] bg-foreground/[0.035] px-2.5 py-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/55">Credits</span>
          <span className="text-xs font-black text-primary">{credits.remaining.toLocaleString()} left</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-foreground/10">
          <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${usedPercent}%` }} />
        </div>
        <div className="mt-1.5 flex justify-between gap-2 text-[10px] text-foreground/55">
          <span>{credits.used.toLocaleString()} used</span>
          <span>{expiry}</span>
        </div>
      </div>
    );
  }

  return (
    <section className="mx-auto mb-4 w-full max-w-7xl px-3 sm:px-8" aria-label="Credit balance">
      <div className="dashboard-credit-summary rounded-2xl border border-foreground/10 bg-foreground/[0.035] px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-primary" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/55">Credits remaining</p>
              <p className="text-lg font-black text-foreground">{credits.remaining.toLocaleString()}</p>
            </div>
          </div>
          <div className="min-w-40 flex-1">
            <div className="mb-1 flex justify-between text-[10px] font-semibold text-foreground/55">
              <span>{credits.used.toLocaleString()} used</span>
              <span>{credits.total.toLocaleString()} total</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-foreground/10">
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${usedPercent}%` }} />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-foreground/65">
            <Gauge className="h-4 w-4 text-primary" />
            <span>Monthly {credits.monthly.toLocaleString()} / Bonus {credits.bonus.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-foreground/65">
            <CalendarClock className="h-4 w-4 text-primary" />
            <span>{expiry}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

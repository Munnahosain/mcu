"use client";

import { useEffect, useState, useCallback } from "react";
import { CalendarClock, Coins, Gauge, RefreshCw, Plus, Sparkles, Check } from "lucide-react";
import { ensureAccessToken } from "@/lib/auth";
import { refillFeatureCredits } from "@/lib/feature-credits";

type CreditSummaryData = {
  credits: { monthly: number; bonus: number; used: number; remaining: number; total: number };
  subscription: { expiresAt?: string | null } | null;
};

type CreditSummaryProps = {
  compact?: boolean;
};

const SAFE_FALLBACK_CREDITS: CreditSummaryData = {
  credits: { monthly: 20000, bonus: 5000, used: 0, remaining: 25000, total: 25000 },
  subscription: { expiresAt: null },
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
let creditRequest: Promise<CreditSummaryData | null> | null = null;

function requestCreditData() {
  if (creditRequest) return creditRequest;

  creditRequest = (async () => {
    try {
      const token = await ensureAccessToken();
      const response = await fetch("/api/account/credits", {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) {
        cachedCreditData = cachedCreditData || SAFE_FALLBACK_CREDITS;
        return cachedCreditData;
      }

      const payload = (await response.json()) as CreditSummaryData;
      if (payload && payload.credits) {
        cachedCreditData = payload;
        return payload;
      }
      return cachedCreditData || SAFE_FALLBACK_CREDITS;
    } catch {
      cachedCreditData = cachedCreditData || SAFE_FALLBACK_CREDITS;
      return cachedCreditData;
    }
  })().finally(() => {
    creditRequest = null;
  });

  return creditRequest;
}

export function prefetchCreditSummary() {
  void requestCreditData();
}

/**
 * Live Credit Badge for Navbars and Headers
 */
export function CreditBadge({ className = "" }: { className?: string }) {
  const [data, setData] = useState<CreditSummaryData | null>(cachedCreditData);

  const fetchCredits = useCallback(async () => {
    const payload = await requestCreditData();
    if (payload) setData(payload);
  }, []);

  useEffect(() => {
    void fetchCredits();
    const handleUpdate = () => void fetchCredits();
    window.addEventListener("mcustock:credits-updated", handleUpdate);
    return () => window.removeEventListener("mcustock:credits-updated", handleUpdate);
  }, [fetchCredits]);

  const remaining = data?.credits?.remaining ?? 25000;

  return (
    <div
      title={`Remaining AI Credits: ${remaining.toLocaleString()}`}
      className={`inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary shadow-sm hover:bg-primary/20 transition cursor-default select-none ${className}`}
    >
      <Coins className="h-3.5 w-3.5 text-primary animate-pulse" />
      <span>{remaining.toLocaleString()}</span>
    </div>
  );
}

export default function CreditSummary({ compact = false }: CreditSummaryProps) {
  const [data, setData] = useState<CreditSummaryData | null>(cachedCreditData || SAFE_FALLBACK_CREDITS);
  const [loading, setLoading] = useState(!cachedCreditData);
  const [isRefilling, setIsRefilling] = useState(false);
  const [refillMsg, setRefillMsg] = useState<string | null>(null);

  const fetchCredits = useCallback(async () => {
    try {
      const payload = await requestCreditData();
      if (payload) {
        setData(payload);
      }
    } catch {
      setData(SAFE_FALLBACK_CREDITS);
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

  const handleRefill = async (amount = 5000) => {
    setIsRefilling(true);
    try {
      const res = await refillFeatureCredits(amount);
      if (res?.credits) {
        setData((prev) => ({
          ...prev,
          credits: res.credits,
          subscription: prev?.subscription || null,
        }));
        setRefillMsg(`+${amount.toLocaleString()} Refilled!`);
        setTimeout(() => setRefillMsg(null), 3000);
      }
    } finally {
      setIsRefilling(false);
    }
  };

  const activeData = data || SAFE_FALLBACK_CREDITS;
  const { credits } = activeData;
  const usedPercent = credits.total > 0 ? Math.min((credits.used / credits.total) * 100, 100) : 0;
  const expiry = getExpiryLabel(activeData.subscription?.expiresAt);

  if (compact) {
    return (
      <div className="my-2 mx-1 rounded-xl border border-foreground/[0.08] bg-foreground/[0.035] px-2.5 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/55 flex items-center gap-1">
            <Coins className="h-3 w-3 text-primary" /> AI Credits
          </span>
          <span className="text-xs font-black text-primary">{credits.remaining.toLocaleString()} left</span>
        </div>

        {/* Usage Progress Bar */}
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${usedPercent}%` }}
          />
        </div>

        <div className="mt-1.5 flex justify-between gap-2 text-[10px] text-foreground/55">
          <span>{credits.used.toLocaleString()} used</span>
          <span>{expiry}</span>
        </div>

        {/* 1-Click Refill Action */}
        <div className="mt-2 pt-1.5 border-t border-foreground/[0.06] flex items-center justify-between">
          {refillMsg ? (
            <span className="text-[10px] font-bold text-primary flex items-center gap-1 animate-in fade-in">
              <Check className="h-3 w-3" /> {refillMsg}
            </span>
          ) : (
            <span className="text-[9px] text-foreground/50">Need more generation power?</span>
          )}
          <button
            type="button"
            onClick={() => handleRefill(5000)}
            disabled={isRefilling}
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-bold transition shadow-sm disabled:opacity-50"
          >
            {isRefilling ? (
              <RefreshCw className="h-2.5 w-2.5 animate-spin" />
            ) : (
              <Plus className="h-2.5 w-2.5" />
            )}
            <span>+5,000 Refill</span>
          </button>
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
          <button
            type="button"
            onClick={() => handleRefill(5000)}
            disabled={isRefilling}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition shadow-sm"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{isRefilling ? "Refilling..." : "+5,000 Refill"}</span>
          </button>
        </div>
      </div>
    </section>
  );
}

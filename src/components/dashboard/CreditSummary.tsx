"use client";

import { useEffect, useState, useCallback } from "react";
import { CalendarClock, Coins, Gauge } from "lucide-react";
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
let creditRequest: Promise<CreditSummaryData | null> | null = null;
let creditRevision = 0;

function requestCreditData() {
  if (creditRequest) return creditRequest;

  const requestRevision = creditRevision;
  creditRequest = (async () => {
    try {
      const token = await ensureAccessToken();
      const response = await fetch("/api/account/credits", {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) {
        throw new Error(`Unable to load credits (HTTP ${response.status}).`);
      }

      const payload = (await response.json()) as CreditSummaryData;
      if (!payload?.credits) {
        throw new Error("Credit balance response was invalid.");
      }
      if (requestRevision !== creditRevision) return cachedCreditData;
      cachedCreditData = payload;
      return payload;
    } catch (error) {
      console.error("[Credits] Unable to load balance:", error);
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

export default function CreditSummary({ compact = false }: CreditSummaryProps) {
  const [data, setData] = useState<CreditSummaryData | null>(cachedCreditData);
  const [loading, setLoading] = useState(!cachedCreditData);

  const fetchCredits = useCallback(async (refresh = false) => {
    try {
      const pendingRequest = creditRequest;
      if (refresh && pendingRequest) await pendingRequest;
      const payload = await requestCreditData();
      if (payload) {
        setData(payload);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCredits();

    // Listen for custom credit update events triggered after generation or admin changes
    const handleUpdate = (event: Event) => {
      if (event instanceof CustomEvent && isCreditSnapshot(event.detail)) {
        creditRevision += 1;
        cachedCreditData = {
          credits: event.detail,
          subscription: cachedCreditData?.subscription || null,
        };
        setData(cachedCreditData);
        return;
      }
      void fetchCredits(true);
    };

    window.addEventListener("mcustock:credits-updated", handleUpdate);
    return () => {
      window.removeEventListener("mcustock:credits-updated", handleUpdate);
    };
  }, [fetchCredits]);

  if (!data) {
    const message = loading ? "Loading credits..." : "Credit balance unavailable";
    return compact ? (
      <div className="my-2 mx-1 rounded-xl border border-foreground/[0.08] bg-foreground/[0.035] px-2.5 py-2.5 text-[10px] text-foreground/60" role="status">
        {message}
      </div>
    ) : (
      <section className="mx-auto mb-4 w-full max-w-7xl px-3 sm:px-8" aria-label="Credit balance">
        <div className="dashboard-credit-summary rounded-2xl border border-foreground/10 bg-foreground/[0.035] px-4 py-3 text-sm text-foreground/60" role="status">
          {message}
        </div>
      </section>
    );
  }

  function isCreditSnapshot(value: unknown): value is CreditSummaryData["credits"] {
    if (!value || typeof value !== "object") return false;
    const credits = value as Partial<CreditSummaryData["credits"]>;
    return ["monthly", "bonus", "used", "remaining", "total"].every(
      (key) => typeof credits[key as keyof typeof credits] === "number"
    );
  }

  const activeData = data;
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

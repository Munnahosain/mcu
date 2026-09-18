"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Coins, Gauge } from "lucide-react";
import { ensureAccessToken } from "@/lib/auth";

type CreditSummaryData = {
  credits: { monthly: number; bonus: number; used: number; remaining: number; total: number };
  subscription: { expiresAt?: string | null } | null;
};

type CreditSummaryProps = {
  compact?: boolean;
};

export default function CreditSummary({ compact = false }: CreditSummaryProps) {
  const [data, setData] = useState<CreditSummaryData | null>(null);

  useEffect(() => {
    let cancelled = false;
    void ensureAccessToken().then((token) => fetch("/api/account/credits", {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })).then(async (response) => {
      if (!response.ok) return;
      const payload = await response.json() as CreditSummaryData;
      if (!cancelled) setData(payload);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  if (!data) return null;

  const { credits } = data;
  const usedPercent = credits.total > 0 ? Math.min((credits.used / credits.total) * 100, 100) : 0;
  const expiry = data.subscription?.expiresAt
    ? new Date(data.subscription.expiresAt).toLocaleDateString()
    : "No expiry set";

  if (compact) {
    return (
      <div className="mx-1 rounded-xl border border-foreground/[0.08] bg-foreground/[0.035] px-2.5 py-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/55">Credits</span>
          <span className="text-xs font-black text-primary">{credits.remaining.toLocaleString()} left</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-foreground/10">
          <div className="h-full rounded-full bg-primary" style={{ width: `${usedPercent}%` }} />
        </div>
        <div className="mt-1.5 flex justify-between gap-2 text-[10px] text-foreground/55">
          <span>{credits.used.toLocaleString()} used</span>
          <span>Expires {expiry}</span>
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
            <span>Expires {expiry}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

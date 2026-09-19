"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  CreditCard,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  History,
  XCircle,
  Loader2,
} from "lucide-react";

interface IBillingData {
  user?: {
    id: string;
    email: string;
    name: string;
    credits?: number;
    role: string;
  };
  plan?: {
    name: string;
    slug: string;
    monthlyPrice?: number;
    yearlyPrice?: number;
    monthlyCredits?: number;
    creditRolloverEnabled?: boolean;
    maxRolloverCredits?: number;
    activeDeviceLimit?: number;
  };
  subscription?: {
    id?: string;
    status: string;
    billingInterval?: string;
    startedAt?: string;
    currentPeriodStart?: string;
    currentPeriodEnd?: string | null;
    expiresAt?: string | null;
    cancelledAt?: string | null;
  } | null;
  credits?: {
    balance?: number;
    remaining?: number;
    monthly?: number;
    bonus?: number;
    used?: number;
    monthlyAllowance?: number;
    rolloverCredits?: number;
    usedThisCycle?: number;
    usagePercent?: number;
  };
  transactions?: Array<{
    _id?: string;
    id?: string;
    type: string;
    amount: number;
    balanceBefore?: number;
    balanceAfter?: number;
    description?: string;
    reason?: string;
    createdAt: string;
  }>;
}

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

export default function BillingPage() {
  const [data, setData] = useState<IBillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchBilling = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/account/billing");
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBilling();
  }, []);

  const handleSubscriptionAction = async (action: "cancel" | "resume") => {
    if (!confirm(`Are you sure you want to ${action} your subscription?`)) return;

    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/account/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error || `Failed to ${action} subscription`);
      }
      setFeedback({
        type: "success",
        text: action === "cancel" 
          ? "Subscription renewal cancelled. You will retain access until the end of the billing period." 
          : "Subscription renewal resumed successfully.",
      });
      await fetchBilling();
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Action failed",
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-foreground/60">
        <p>Failed to load billing information.</p>
        <button
          onClick={fetchBilling}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-background"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    );
  }

  const isFree = (data.plan?.slug || "free") === "free";
  const isCancelled = Boolean(data.subscription?.cancelledAt);
  const remainingCredits = data.credits?.balance ?? data.credits?.remaining ?? 0;
  const monthlyAllowance = data.credits?.monthlyAllowance ?? data.plan?.monthlyCredits ?? 100;
  const usedCredits = data.credits?.usedThisCycle ?? data.credits?.used ?? 0;
  const usagePercent = data.credits?.usagePercent ?? (monthlyAllowance > 0 ? Math.min(100, Math.round((usedCredits / monthlyAllowance) * 100)) : 0);
  const isLowCredits = !isFree && remainingCredits < monthlyAllowance * 0.2;
  const isZeroCredits = remainingCredits <= 0;
  const renewalLabel = getExpiryLabel(data.subscription?.currentPeriodEnd || data.subscription?.expiresAt || null);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 pb-20 pt-2 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-foreground/10 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold text-primary mb-1 uppercase tracking-wider">
            <CreditCard className="h-4 w-4" /> Account &amp; Billing
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground">
            Plan &amp; Usage Overview
          </h1>
          <p className="text-xs sm:text-sm text-foreground/60 mt-1">
            Manage your MCUSTOCK subscription, monitor AI credit balance, and track transactions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/pricing"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-background shadow-md shadow-primary/20 hover:bg-primary-hover active:scale-[0.98] transition-all"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Upgrade / Change Plan</span>
          </Link>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold transition-all ${
            feedback.type === "success"
              ? "bg-primary/15 text-primary border border-primary/30"
              : "bg-red-500/15 text-red-400 border border-red-500/30"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Credit Alerts */}
      {isZeroCredits ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-red-300">You&apos;ve used all available AI credits.</p>
              <p className="text-[11px] text-red-200/70">Upgrade your plan to continue generating metadata and prompts.</p>
            </div>
          </div>
          <Link
            href="/dashboard/pricing"
            className="shrink-0 rounded-xl bg-red-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-600 transition-colors"
          >
            Upgrade Plan
          </Link>
        </div>
      ) : isLowCredits ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-300">You&apos;re running low on AI credits.</p>
              <p className="text-[11px] text-amber-200/70">You have fewer than 20% of your credits remaining this cycle.</p>
            </div>
          </div>
          <Link
            href="/dashboard/pricing"
            className="shrink-0 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-background hover:bg-amber-600 transition-colors"
          >
            View Plans
          </Link>
        </div>
      ) : null}

      {/* Overview Cards (Plan, Usage, Subscription) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Current Plan Card */}
        <div className="rounded-3xl border border-foreground/10 bg-foreground/[0.02] p-6 space-y-4 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground/50">Current Plan</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                isCancelled
                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                  : (data.subscription?.status || "active") === "active"
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "bg-foreground/10 text-foreground/60 border border-foreground/20"
              }`}
            >
              {isCancelled ? "Cancelling" : (data.subscription?.status || "active")}
            </span>
          </div>

          <div>
            <h2 className="text-2xl font-black text-foreground">{data.plan?.name || "Free"}</h2>
            <p className="text-xs text-foreground/60 mt-0.5">
              {isFree
                ? "Forever Free Tier"
                : `${data.subscription?.billingInterval === "year" ? "Yearly" : "Monthly"} Billing (৳${
                    data.subscription?.billingInterval === "year"
                      ? (data.plan?.yearlyPrice ?? 0).toLocaleString()
                      : (data.plan?.monthlyPrice ?? 0).toLocaleString()
                  })`}
            </p>
          </div>

          <div className="pt-3 border-t border-foreground/5 space-y-2 text-xs">
            <div className="flex justify-between text-foreground/70">
              <span>Device Limit:</span>
              <span className="font-bold text-foreground">{data.plan?.activeDeviceLimit ?? 1} Active Devices</span>
            </div>
            <div className="flex justify-between text-foreground/70">
              <span>Rollover:</span>
              <span className="font-bold text-foreground">
                {data.plan?.creditRolloverEnabled
                  ? `Enabled (Up to ${(data.plan?.maxRolloverCredits ?? 0).toLocaleString()})`
                  : "Not Included"}
              </span>
            </div>
          </div>
        </div>

        {/* Credit Usage Progress */}
        <div className="rounded-3xl border border-foreground/10 bg-foreground/[0.02] p-6 space-y-4 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground/50">Credit Usage</span>
            <span className="text-xs font-bold text-primary">
              {usagePercent}% Used
            </span>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-foreground">
                {remainingCredits.toLocaleString()}
              </span>
              <span className="text-xs text-foreground/50">
                of {monthlyAllowance.toLocaleString()} Credits
              </span>
            </div>
            <p className="text-xs text-foreground/60 mt-0.5">Credits remaining this period</p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5 pt-1">
            <div className="h-2 w-full rounded-full bg-foreground/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  usagePercent > 80 ? "bg-amber-500" : "bg-primary"
                }`}
                style={{ width: `${Math.min(100, usagePercent)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-foreground/50">
              <span>{usedCredits.toLocaleString()} used</span>
              <span>{remainingCredits.toLocaleString()} left</span>
            </div>
          </div>
        </div>

        {/* Subscription Renewal & Actions */}
        <div className="rounded-3xl border border-foreground/10 bg-foreground/[0.02] p-6 space-y-4 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground/50">Renewal Cycle</span>
              <Calendar className="h-4 w-4 text-foreground/40" />
            </div>

            <div className="mt-2">
              <span className="text-xs text-foreground/60 block">Next Renewal / Reset Date:</span>
              <p className="text-lg font-bold text-foreground mt-0.5">{renewalLabel}</p>
            </div>
          </div>

          <div className="pt-3 border-t border-foreground/5 flex flex-wrap gap-2">
            {!isFree && (
              isCancelled ? (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleSubscriptionAction("resume")}
                  className="w-full rounded-xl border border-primary/40 bg-primary/10 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition-all flex items-center justify-center gap-1.5"
                >
                  {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  <span>Resume Subscription</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleSubscriptionAction("cancel")}
                  className="w-full rounded-xl border border-red-500/20 bg-red-500/5 py-2 text-xs font-bold text-red-400 hover:bg-red-500/10 transition-all flex items-center justify-center gap-1.5"
                >
                  {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                  <span>Cancel Renewal</span>
                </button>
              )
            )}
            <Link
              href="/dashboard/pricing"
              className="w-full rounded-xl border border-foreground/10 bg-foreground/5 py-2 text-xs font-bold text-foreground/80 hover:bg-foreground/10 transition-all text-center"
            >
              Change Billing Plan
            </Link>
          </div>
        </div>
      </div>

      {/* Credit Ledger / Transaction History */}
      <div className="rounded-3xl border border-foreground/10 bg-foreground/[0.02] p-6 sm:p-8 space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-foreground flex items-center gap-2">
              <History className="h-5 w-5 text-primary" /> Credit History &amp; Ledger
            </h2>
            <p className="text-xs text-foreground/50">
              Audit log of all AI credit grants, generations, refunds, and adjustments.
            </p>
          </div>
          <button
            onClick={fetchBilling}
            className="inline-flex items-center gap-1.5 text-xs text-foreground/60 hover:text-foreground font-semibold"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>

        {(!data.transactions || data.transactions.length === 0) ? (
          <div className="p-8 text-center text-xs text-foreground/40 border border-dashed border-foreground/10 rounded-2xl">
            No credit transactions recorded yet. Start using AI tools or upgrade a plan to see activity here.
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b border-foreground/10 text-foreground/50 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Date &amp; Time</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Balance After</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((tx, idx) => {
                  const isPositive = (tx.amount ?? 0) > 0;
                  const key = tx._id || tx.id || `tx-${idx}`;
                  return (
                    <tr key={key} className="border-b border-foreground/5 hover:bg-foreground/[0.02] transition-colors">
                      <td className="py-3 px-4 text-foreground/60 font-medium whitespace-nowrap">
                        {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }) : "—"}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            (tx.type || "").includes("grant") || (tx.type || "").includes("purchase") || (tx.type || "").includes("rollover")
                              ? "bg-primary/10 text-primary border border-primary/20"
                              : (tx.type || "").includes("refund")
                              ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              : "bg-foreground/5 text-foreground/60 border border-foreground/10"
                          }`}
                        >
                          {(tx.type || "transaction").replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-foreground/80 font-medium">{tx.description || tx.reason || "Operation"}</td>
                      <td className={`py-3 px-4 text-right font-black ${isPositive ? "text-primary" : "text-foreground/70"}`}>
                        {isPositive ? `+${(tx.amount ?? 0).toLocaleString()}` : (tx.amount ?? 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-foreground/90">
                        {(tx.balanceAfter ?? 0).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

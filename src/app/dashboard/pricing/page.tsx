"use client";

import { useState, useEffect, Fragment } from "react";
import Link from "next/link";
import {
  Check,
  Crown,
  Sparkles,
  Star,
  Zap,
  ArrowRight,
  HelpCircle,
  Layers,
  ChevronDown,
  CreditCard,
  Loader2,
  Minus,
  X,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SegmentedToggle from "@/components/ui/SegmentedToggle";

interface IPlanData {
  _id?: string;
  name: string;
  slug: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  price?: number;
  currency?: string;
  monthlyCredits: number;
  batchLimit?: number;
  bgRemovalLimit?: number;
  creditRolloverEnabled?: boolean;
  maxRolloverCredits?: number;
  activeDeviceLimit?: number;
  badgeText?: string;
  isPopular?: boolean;
  ctaText?: string;
  features: string[];
}

const FALLBACK_PLANS: IPlanData[] = [
  {
    slug: "free",
    name: "Free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    currency: "BDT",
    monthlyCredits: 100,
    batchLimit: 5,
    bgRemovalLimit: 3,
    creditRolloverEnabled: false,
    maxRolloverCredits: 0,
    activeDeviceLimit: 1,
    badgeText: "",
    isPopular: false,
    ctaText: "Get Started Free",
    description: "Explore the MCUSTOCK workflow and start producing stock assets.",
    features: [
      "100 AI credits / month",
      "5 files / batch limit",
      "Limited Background Remover (3 / month)",
      "AI Metadata Generator (Title, Desc, Keywords)",
      "AI Prompt Studio",
      "Basic 3D Icon Studio (Basic Materials & Lighting)",
      "Vector Sheet Splitter",
      "Smart Grid & Bento Lab",
      "Color Palette Studio",
      "ASCII Studio & Events Trends",
      "Stock CSV Export",
      "Multi-provider BYO API Keys",
      "1 active device",
    ],
  },
  {
    slug: "creator",
    name: "Creator",
    monthlyPrice: 199,
    yearlyPrice: 1990,
    currency: "BDT",
    monthlyCredits: 2000,
    batchLimit: 25,
    bgRemovalLimit: 50,
    creditRolloverEnabled: true,
    maxRolloverCredits: 2000,
    activeDeviceLimit: 2,
    badgeText: "",
    isPopular: false,
    ctaText: "Start Creating",
    description: "For individual creators producing and submitting content regularly.",
    features: [
      "2,000 AI credits / month",
      "25 files / batch limit",
      "High-Res Background Remover (50 / month)",
      "Batch Metadata Generation",
      "Advanced Metadata & Keyword Controls",
      "AI Prompt Studio with advanced controls",
      "Advanced 3D Icon Studio (PBR & Studio Lighting)",
      "GLTF 3D Export",
      "Vector Sheet Splitter with 3D Handoff",
      "TODOTOOL Typebox Studio",
      "Smart Grid & Bento & Color Palette",
      "Stock CSV, PNG, SVG & JSON Exports",
      "Multi-provider BYO API Keys",
      "Priority AI Processing",
      "Credit Rollover (Up to 2,000)",
      "2 active devices",
    ],
  },
  {
    slug: "pro",
    name: "Pro",
    monthlyPrice: 499,
    yearlyPrice: 4990,
    currency: "BDT",
    monthlyCredits: 7500,
    batchLimit: 100,
    bgRemovalLimit: 200,
    creditRolloverEnabled: true,
    maxRolloverCredits: 7500,
    activeDeviceLimit: 3,
    badgeText: "MOST POPULAR",
    isPopular: true,
    ctaText: "Go Pro",
    description: "For serious stock contributors who want a complete AI-powered production workflow.",
    features: [
      "7,500 AI credits / month",
      "100 files / batch (Large Batch)",
      "4K Clean Alpha BG Remover (200 / month)",
      "Advanced Metadata & SEO Generator",
      "Advanced Prompt Studio with Presets",
      "3D Icon Studio PRO (Materials, Lighting, PMREM IBL)",
      "GLTF, OBJ & MP4 3D Exports",
      "Vector Sheet Splitter 1-Click 3D Handoff",
      "TODOTOOL Typebox Studio (All 6 engines)",
      "Smart Grid & Bento Grid Suite",
      "Color Palette Studio",
      "All Export Formats (CSV, PNG, SVG, JSON, 3D)",
      "Multi-provider BYO API Keys",
      "Priority Queue Processing",
      "Credit Rollover (Up to 7,500)",
      "3 active devices",
    ],
  },
  {
    slug: "studio",
    name: "Studio",
    monthlyPrice: 999,
    yearlyPrice: 9990,
    currency: "BDT",
    monthlyCredits: 20000,
    batchLimit: 250,
    bgRemovalLimit: 500,
    creditRolloverEnabled: true,
    maxRolloverCredits: 20000,
    activeDeviceLimit: 5,
    badgeText: "",
    isPopular: false,
    ctaText: "Choose Studio",
    description: "Maximum production throughput and dedicated capacity for high-volume creators.",
    features: [
      "20,000 AI credits / month",
      "250 files / batch (Very Large Batch)",
      "Ultra-HD BG Remover (500 / month)",
      "Advanced Metadata & Bulk Stock Automation",
      "Advanced Prompt Studio (Unlimited Presets)",
      "Studio 3D Engine (Custom HDRI, Turntable MP4)",
      "GLTF, OBJ & MP4 3D Exports",
      "Vector Sheet Splitter Unlimited + 3D Sync",
      "TODOTOOL Typebox Studio",
      "Smart Grid & Bento & Color Palette",
      "All Export Formats (CSV, PNG, SVG, JSON, 3D)",
      "Multi-provider BYO API Keys",
      "Maximum Generation Priority",
      "Credit Rollover (Up to 20,000)",
      "5 active devices",
      "24/7 Dedicated VIP Priority Support",
    ],
  },
];

const COMPARISON_CATEGORIES = [
  {
    category: "AI Generation & Metadata",
    items: [
      { name: "AI Metadata Generator", free: "✓", creator: "✓", pro: "✓", studio: "✓" },
      { name: "AI Prompt Studio", free: "✓", creator: "✓", pro: "✓", studio: "✓" },
      { name: "Batch Metadata", free: "—", creator: "✓", pro: "✓", studio: "✓" },
      { name: "Advanced Metadata", free: "—", creator: "✓", pro: "✓", studio: "✓" },
      { name: "Priority Processing", free: "—", creator: "✓", pro: "✓", studio: "Maximum" },
      { name: "Multi-provider BYO API Keys", free: "✓", creator: "✓", pro: "✓", studio: "✓" },
    ],
  },
  {
    category: "Creative Studios & 3D",
    items: [
      { name: "3D Icon Studio", free: "Basic", creator: "Advanced", pro: "Advanced", studio: "Advanced" },
      { name: "3D Materials", free: "Basic", creator: "✓", pro: "✓", studio: "✓" },
      { name: "3D Lighting", free: "Basic", creator: "✓", pro: "✓", studio: "✓" },
      { name: "GLTF Export", free: "—", creator: "✓", pro: "✓", studio: "✓" },
      { name: "OBJ Export", free: "—", creator: "—", pro: "✓", studio: "✓" },
      { name: "MP4 Export", free: "—", creator: "—", pro: "✓", studio: "✓" },
      { name: "AI Background Remover", free: "Limited", creator: "✓", pro: "✓", studio: "✓" },
      { name: "Vector Sheet Splitter", free: "✓", creator: "✓", pro: "✓", studio: "✓" },
      { name: "3D Handoff", free: "—", creator: "✓", pro: "✓", studio: "✓" },
      { name: "Smart Grid & Bento", free: "✓", creator: "✓", pro: "✓", studio: "✓" },
      { name: "Color Palette", free: "✓", creator: "✓", pro: "✓", studio: "✓" },
      { name: "Typebox Studio", free: "—", creator: "✓", pro: "✓", studio: "✓" },
      { name: "ASCII Studio", free: "✓", creator: "✓", pro: "✓", studio: "✓" },
      { name: "Events Trends", free: "✓", creator: "✓", pro: "✓", studio: "✓" },
    ],
  },
  {
    category: "Export Formats",
    items: [
      { name: "Stock CSV Export", free: "✓", creator: "✓", pro: "✓", studio: "✓" },
      { name: "PNG Export", free: "—", creator: "✓", pro: "✓", studio: "✓" },
      { name: "SVG Export", free: "—", creator: "✓", pro: "✓", studio: "✓" },
      { name: "JSON Export", free: "—", creator: "✓", pro: "✓", studio: "✓" },
    ],
  },
  {
    category: "Limits & Entitlements",
    items: [
      { name: "Monthly AI Credits", free: "100 / mo", creator: "2,000 / mo", pro: "7,500 / mo", studio: "20,000 / mo" },
      { name: "Batch Limit", free: "5 files / batch", creator: "25 files / batch", pro: "100 files / batch", studio: "250 files / batch" },
      { name: "BG Remover Quota", free: "3 / month", creator: "50 / month", pro: "200 / month", studio: "500 / month" },
      { name: "Large Batch Support", free: "—", creator: "—", pro: "✓", studio: "✓" },
      { name: "Very Large Batch Support", free: "—", creator: "—", pro: "—", studio: "✓" },
      { name: "Credit Rollover", free: "—", creator: "✓ (Up to 2,000)", pro: "✓ (Up to 7,500)", studio: "✓ (Up to 20,000)" },
      { name: "Active Devices", free: "1", creator: "2", pro: "3", studio: "5" },
      { name: "Priority Support", free: "—", creator: "—", pro: "—", studio: "✓" },
    ],
  },
];

export default function DashboardPricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [plans, setPlans] = useState<IPlanData[]>(FALLBACK_PLANS);
  const [currentPlanSlug, setCurrentPlanSlug] = useState<string>("free");
  const [subscribingSlug, setSubscribingSlug] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Checkout Modal State
  const [checkoutModalPlan, setCheckoutModalPlan] = useState<IPlanData | null>(null);
  const [checkoutSession, setCheckoutSession] = useState<{ subscriptionId: string; invoiceId: string; amount: number } | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("bKash");
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);

  useEffect(() => {
    fetch("/api/plans")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.plans) && data.plans.length > 0) {
          setPlans(data.plans);
        }
      })
      .catch(() => {});

    fetch("/api/account/billing")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.plan) {
          setCurrentPlanSlug(data.plan.slug || "free");
          if (data.subscription?.billingInterval === "year" || data.subscription?.billingInterval === "yearly") {
            setBillingCycle("yearly");
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleSelectPlan = async (plan: IPlanData) => {
    if (plan.slug === currentPlanSlug && plan.slug === "free") return;

    setFeedbackMessage(null);

    // Free plan: Instant switch without payment
    if (plan.slug === "free") {
      setSubscribingSlug(plan.slug);
      try {
        const res = await fetch("/api/plans/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "activate_free" }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || "Failed to switch plan");
        setCurrentPlanSlug("free");
        setFeedbackMessage({ type: "success", text: "Successfully switched to Free plan!" });
        window.dispatchEvent(new CustomEvent("mcustock:credits-updated"));
      } catch (err) {
        setFeedbackMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to switch plan" });
      } finally {
        setSubscribingSlug(null);
      }
      return;
    }

    // Paid Plan: Create server-side checkout session and show checkout modal
    setSubscribingSlug(plan.slug);
    try {
      const res = await fetch("/api/plans/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "checkout",
          planSlug: plan.slug,
          billingInterval: billingCycle === "yearly" ? "year" : "month",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to initialize checkout");

      setCheckoutSession({
        subscriptionId: data.subscriptionId,
        invoiceId: data.invoiceId,
        amount: data.plan.amount,
      });
      setCheckoutModalPlan(plan);
    } catch (err) {
      setFeedbackMessage({ type: "error", text: err instanceof Error ? err.message : "Checkout initialization failed" });
    } finally {
      setSubscribingSlug(null);
    }
  };

  const handleConfirmPayment = async () => {
    if (!checkoutSession || !checkoutModalPlan) return;

    setIsProcessingPayment(true);
    try {
      const res = await fetch("/api/plans/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify_payment",
          subscriptionId: checkoutSession.subscriptionId,
          paymentMethod: selectedPaymentMethod,
          transactionRef: `TXN-${Date.now()}`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Payment verification failed");

      setCurrentPlanSlug(checkoutModalPlan.slug);
      setFeedbackMessage({
        type: "success",
        text: `Payment verified! ${checkoutModalPlan.name} plan is active with ${data.plan.totalCredits.toLocaleString()} credits.`,
      });
      setCheckoutModalPlan(null);
      setCheckoutSession(null);
      window.dispatchEvent(new CustomEvent("mcustock:credits-updated"));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Payment verification failed");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-12 pb-24 pt-2 font-sans">
      {/* Header Banner */}
      <div className="text-center space-y-4 max-w-3xl mx-auto pt-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest shadow-sm">
          <Crown className="h-4 w-4" /> Subscription &amp; Plans
        </div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground">
          Supercharge Your Stock Portfolio with <span className="text-primary">MCUSTOCK AI</span>
        </h1>
        <p className="text-sm sm:text-base text-foreground/60 leading-relaxed font-medium">
          Choose the plan that fits your production volume. Upgrade, downgrade, or switch anytime with zero lock-in.
        </p>

        {feedbackMessage && (
          <div
            className={`p-4 rounded-2xl text-xs font-bold transition-all ${
              feedbackMessage.type === "success"
                ? "bg-primary/15 text-primary border border-primary/30"
                : "bg-red-500/15 text-red-400 border border-red-500/30"
            }`}
          >
            {feedbackMessage.text}
          </div>
        )}

        {/* Monthly / Yearly Billing Toggle */}
        <div className="pt-2 flex flex-col items-center justify-center gap-3">
          <div className="flex items-center justify-center gap-3">
            <SegmentedToggle<"monthly" | "yearly">
              options={[
                { id: "monthly", label: "Monthly" },
                { id: "yearly", label: "Yearly" },
              ]}
              value={billingCycle}
              onChange={(val) => setBillingCycle(val)}
              size="md"
              className="w-auto min-w-[240px]"
              ariaLabel="Billing cycle selection"
            />
            <span className="inline-flex items-center rounded-full bg-primary/15 border border-primary/30 px-3 py-1 text-xs font-bold text-primary animate-pulse">
              Save up to 17% with yearly
            </span>
          </div>

          <Link
            href="/dashboard/billing"
            className="inline-flex items-center gap-1.5 text-xs text-primary font-bold hover:underline mt-1"
          >
            <CreditCard className="h-3.5 w-3.5" />
            <span>Manage billing &amp; view credit transactions &rarr;</span>
          </Link>
        </div>
      </div>

      {/* Pricing Cards Grid (4 Plans) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
        {plans.map((plan) => {
          const monthlyPrice = Number(plan.monthlyPrice ?? plan.price ?? 0);
          const yearlyPrice = Number(plan.yearlyPrice ?? (monthlyPrice * 10));
          const isCurrent = plan.slug === currentPlanSlug;
          const isFree = monthlyPrice === 0;
          const price = billingCycle === "yearly" ? yearlyPrice : monthlyPrice;
          const displayPrice = Number.isFinite(price) ? price : 0;
          const isPopular = plan.isPopular || plan.slug === "pro";
          const isSubmitting = subscribingSlug === plan.slug;

          const monthlyEquivalent = monthlyPrice * 12;
          const yearlySavings = monthlyEquivalent - yearlyPrice;
          const savingsPercent = monthlyEquivalent > 0 ? Math.round((yearlySavings / monthlyEquivalent) * 100) : 0;

          return (
            <div
              key={plan.slug || plan.name}
              className={`relative rounded-3xl border p-6 flex flex-col justify-between transition-all duration-300 ${
                isCurrent
                  ? "border-primary/80 bg-primary/[0.06] ring-2 ring-primary/40 shadow-xl"
                  : isPopular
                  ? "border-primary bg-primary/[0.03] shadow-[0_0_35px_rgba(22,199,132,0.16)] ring-1 ring-primary/40 lg:-translate-y-1"
                  : "border-foreground/10 bg-foreground/[0.02] hover:border-primary/40 shadow-lg"
              }`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-background font-black text-[10px] tracking-widest uppercase shadow-md flex items-center gap-1.5">
                  <Star className="h-3 w-3 fill-current" /> {plan.badgeText || "MOST POPULAR"}
                </div>
              )}

              {isCurrent && !isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-foreground/20 text-foreground font-black text-[10px] tracking-widest uppercase border border-foreground/30 shadow-md">
                  CURRENT PLAN
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-xl font-black text-foreground">{plan.name}</h2>
                    {plan.activeDeviceLimit && (
                      <span className="text-[10px] font-semibold text-foreground/50 border border-foreground/10 px-2 py-0.5 rounded-full">
                        {plan.activeDeviceLimit} {plan.activeDeviceLimit > 1 ? "devices" : "device"}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-foreground/60 min-h-[34px] leading-relaxed">
                    {plan.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-foreground/10">
                  <div className="flex items-baseline gap-1 text-foreground">
                    <span className="text-3xl sm:text-4xl font-black tracking-tight">
                      {isFree ? "৳0" : `৳${displayPrice.toLocaleString()}`}
                    </span>
                    <span className="text-xs font-semibold text-foreground/50">
                      {isFree ? "Forever" : (billingCycle === "yearly" ? "/ yr" : "/ mo")}
                    </span>
                  </div>

                  {billingCycle === "yearly" && !isFree && yearlySavings > 0 && (
                    <p className="mt-1 text-xs font-bold text-primary flex items-center gap-1">
                      <Zap className="h-3 w-3" /> Save ৳{(yearlySavings ?? 0).toLocaleString()} ({savingsPercent}% off)
                    </p>
                  )}

                  <div className="mt-2.5 space-y-1">
                    <div className="inline-flex items-center gap-1.5 rounded-xl border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                      <Sparkles className="h-3 w-3" />
                      {(plan.monthlyCredits ?? 0).toLocaleString()} Credits / mo
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-foreground/60 px-1">
                      <span>Batch: <strong className="text-foreground">{plan.batchLimit || (isFree ? 5 : 25)} files</strong></span>
                      <span>BG: <strong className="text-foreground">{plan.bgRemovalLimit || (isFree ? 3 : 50)}/mo</strong></span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isSubmitting || isCurrent}
                  onClick={() => handleSelectPlan(plan)}
                  className={`w-full py-3 px-4 rounded-2xl text-xs font-bold tracking-wide transition-all flex items-center justify-center gap-2 ${
                    isCurrent
                      ? "bg-foreground/10 text-foreground/50 cursor-default"
                      : isPopular
                      ? "bg-primary text-background hover:bg-primary-hover shadow-lg shadow-primary/25 active:scale-[0.98]"
                      : "border border-primary/30 text-primary hover:bg-primary/10 active:scale-[0.98]"
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : isCurrent ? (
                    <span>Active Plan</span>
                  ) : (
                    <>
                      <span>{isFree ? "Switch to Free" : `Upgrade to ${plan.name}`}</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                {/* Feature Checklist */}
                <div className="space-y-2.5 pt-4 border-t border-foreground/10">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary/70 block">
                    Included Capabilities:
                  </span>
                  {plan.features.slice(0, 10).map((feat, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs font-medium text-foreground/80">
                      <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5 stroke-[2.5]" />
                      <span>{feat}</span>
                    </div>
                  ))}
                  {plan.features.length > 10 && (
                    <p className="text-[10px] text-foreground/40 font-medium pl-5">
                      + {plan.features.length - 10} more capabilities
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-4 text-center text-[11px] text-foreground/40 font-medium border-t border-foreground/5 mt-4">
                {isFree ? "No payment needed" : (plan.creditRolloverEnabled ? "Includes credit rollover" : "Instant activation")}
              </div>
            </div>
          );
        })}
      </div>

      {/* Feature Comparison Table */}
      <div className="rounded-3xl border border-foreground/10 bg-foreground/[0.02] p-6 sm:p-10 space-y-6 shadow-xl">
        <div className="text-center space-y-1">
          <h2 className="text-xl sm:text-2xl font-black text-foreground flex items-center justify-center gap-2">
            <Layers className="h-5 w-5 text-primary" /> Official Feature Matrix
          </h2>
          <p className="text-xs text-foreground/50">Compare tools, limits, and capabilities across all plans.</p>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse min-w-[640px]">
            <thead>
              <tr className="border-b border-foreground/10 text-foreground/70 font-semibold text-[11px]">
                <th className="py-3 px-4 w-2/5">Feature / Capability</th>
                <th className="py-3 px-4 text-center">Free</th>
                <th className="py-3 px-4 text-center">Creator</th>
                <th className="py-3 px-4 text-center text-primary font-black bg-primary/5 rounded-t-xl">Pro</th>
                <th className="py-3 px-4 text-center">Studio</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_CATEGORIES.map((cat, ci) => (
                <Fragment key={ci}>
                  <tr>
                    <td colSpan={5} className="pt-6 pb-2 px-4 font-bold text-primary text-xs uppercase tracking-wider bg-foreground/[0.02]">
                      {cat.category}
                    </td>
                  </tr>
                  {cat.items.map((item, ii) => (
                    <tr key={ii} className="border-b border-foreground/5 hover:bg-foreground/[0.02] transition-colors">
                      <td className="py-3 px-4 font-medium text-foreground/80">{item.name}</td>
                      <td className="py-3 px-4 text-center text-foreground/60">
                        {item.free === "✓" ? <Check className="h-4 w-4 text-primary mx-auto stroke-[2.5]" /> : item.free === "—" ? <Minus className="h-4 w-4 text-foreground/25 mx-auto" /> : item.free}
                      </td>
                      <td className="py-3 px-4 text-center text-foreground/80 font-medium">
                        {item.creator === "✓" ? <Check className="h-4 w-4 text-primary mx-auto stroke-[2.5]" /> : item.creator === "—" ? <Minus className="h-4 w-4 text-foreground/25 mx-auto" /> : item.creator}
                      </td>
                      <td className="py-3 px-4 text-center text-primary font-bold bg-primary/5">
                        {item.pro === "✓" ? <Check className="h-4 w-4 text-primary mx-auto stroke-[2.5]" /> : item.pro === "—" ? <Minus className="h-4 w-4 text-foreground/25 mx-auto" /> : item.pro}
                      </td>
                      <td className="py-3 px-4 text-center text-foreground font-semibold">
                        {item.studio === "✓" ? <Check className="h-4 w-4 text-primary mx-auto stroke-[2.5]" /> : item.studio === "—" ? <Minus className="h-4 w-4 text-foreground/25 mx-auto" /> : item.studio}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Checkout Session Modal (bKash / Nagad / Card Gateway Flow) */}
      <AnimatePresence>
        {checkoutModalPlan && checkoutSession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg rounded-3xl border border-primary/30 bg-[#071915] p-6 sm:p-8 text-foreground shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">Subscribe to {checkoutModalPlan.name}</h3>
                    <p className="text-xs text-white/50">Invoice: {checkoutSession.invoiceId}</p>
                  </div>
                </div>
                <button
                  onClick={() => setCheckoutModalPlan(null)}
                  className="rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Order Summary */}
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-3">
                <div className="flex justify-between text-xs text-white/70">
                  <span>Plan:</span>
                  <span className="font-bold text-white">{checkoutModalPlan.name} ({billingCycle === "yearly" ? "Yearly" : "Monthly"})</span>
                </div>
                <div className="flex justify-between text-xs text-white/70">
                  <span>Credits Allocation:</span>
                  <span className="font-bold text-primary">{checkoutModalPlan.monthlyCredits.toLocaleString()} AI Credits / mo</span>
                </div>
                <div className="flex justify-between text-xs text-white/70">
                  <span>Device Limit:</span>
                  <span className="font-bold text-white">{checkoutModalPlan.activeDeviceLimit} Devices</span>
                </div>
                <div className="pt-2 border-t border-white/10 flex justify-between text-sm">
                  <span className="font-bold text-white">Total Payable:</span>
                  <span className="text-lg font-black text-primary">৳{checkoutSession.amount.toLocaleString()} BDT</span>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-white/70">
                  Select Payment Method:
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "bKash", name: "bKash", color: "border-pink-500/40 bg-pink-500/10 text-pink-300" },
                    { id: "Nagad", name: "Nagad", color: "border-orange-500/40 bg-orange-500/10 text-orange-300" },
                    { id: "Card", name: "Card / Bank", color: "border-blue-500/40 bg-blue-500/10 text-blue-300" },
                  ].map((method) => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setSelectedPaymentMethod(method.id)}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        selectedPaymentMethod === method.id
                          ? `${method.color} ring-2 ring-primary`
                          : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                      }`}
                    >
                      <span className="text-xs font-bold block">{method.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-white/5 p-3 text-[11px] text-white/50 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                <span>Secure SSL encrypted checkout. Credits and plan benefits activate immediately upon verification.</span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCheckoutModalPlan(null)}
                  className="flex-1 rounded-xl border border-white/10 py-3 text-xs font-bold text-white/70 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isProcessingPayment}
                  onClick={handleConfirmPayment}
                  className="flex-[2] inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-xs font-bold text-[#06251b] hover:bg-primary-hover active:scale-[0.98] transition-all shadow-lg shadow-primary/25"
                >
                  {isProcessingPayment ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Verifying Payment...</span>
                    </>
                  ) : (
                    <>
                      <span>Confirm &amp; Pay ৳{checkoutSession.amount.toLocaleString()}</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

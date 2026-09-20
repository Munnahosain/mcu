"use client";

import { useState, useEffect, Fragment } from "react";
import Link from "next/link";
import { ArrowRight, Check, Minus, Sparkles, Star, Layers, HelpCircle, ChevronDown, Zap, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import MarketingChrome from "../../components/MarketingChrome";
import MarketingFooter from "../../components/MarketingFooter";
import SegmentedToggle from "@/components/ui/SegmentedToggle";
import { ensureAccessToken, getAuthUser } from "@/lib/auth";
import PaymentCheckoutModal from "@/components/PaymentCheckoutModal";

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
  sortOrder?: number;
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

const FAQS = [
  {
    q: "What are AI credits?",
    a: "AI credits are the usage units MCUSTOCK uses for AI-powered operations. Different operations require different amounts of credits (e.g. 1 credit for metadata or prompt generation, 2 credits for advanced metadata, and 5 credits for high-res background removal).",
  },
  {
    q: "Do credits expire?",
    a: "Free credits reset with each 30-day Free cycle. Paid-plan credits follow your billing cycle and roll over into the next month according to your plan's rollover policy (e.g. up to 7,500 credits rollover on the Pro plan).",
  },
  {
    q: "Can I use my own API key?",
    a: "Yes! MCUSTOCK supports multiple AI providers including Groq, Google Gemini, OpenAI, Mistral AI and OpenRouter. You can configure your own provider keys in Settings.",
  },
  {
    q: "What happens when I run out of credits?",
    a: "AI operations that require credits will pause until your credits renew, you upgrade your plan, or you add more credits. All your non-AI tools (such as Vector Splitter, Grids, Palettes, and Export viewers) continue working without interruption.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. You can cancel your subscription at any time with zero penalty. Cancellation stops the next renewal, and your existing paid benefits remain active until the end of the current billing cycle.",
  },
  {
    q: "Can I upgrade later?",
    a: "Yes! You can upgrade, downgrade, or switch between monthly and yearly billing anytime from your Account Billing page.",
  },
  {
    q: "Do failed requests consume credits?",
    a: "No! Never. MCUSTOCK only charges credits for operations that succeed. If an operation fails or a batch partially fails, you are only deducted for successfully processed items.",
  },
];

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [plans, setPlans] = useState<IPlanData[]>(FALLBACK_PLANS);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [checkoutPlan, setCheckoutPlan] = useState<IPlanData | null>(null);
  const [paymentMessage, setPaymentMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    void ensureAccessToken().then((token) => {
      if (!cancelled) setIsLoggedIn(Boolean(token && getAuthUser()));
    });

    fetch("/api/plans")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.plans) && data.plans.length > 0) {
          setPlans(data.plans);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleFaq = (idx: number) => {
    setOpenFaqIndex(openFaqIndex === idx ? null : idx);
  };

  return (
    <div className="liquid-page-shell min-h-screen pt-24 bg-background text-foreground">
      <MarketingChrome activePath="/pricing" />

      <main className="mx-auto max-w-7xl space-y-20 px-4 pb-24 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="mx-auto max-w-3xl space-y-5 text-center pt-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Transparent Bangladeshi Taka (৳ BDT) Pricing
          </div>

          <h1 className="liquid-title text-4xl font-extrabold tracking-tight md:text-6xl text-foreground">
            Simple pricing for serious stock creators.
          </h1>

          <p className="liquid-copy text-base md:text-lg text-foreground/70 max-w-2xl mx-auto leading-relaxed">
            Start free, upgrade when you need more AI power. Choose the plan that fits your workflow and scale your content production without unnecessary complexity.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="pt-4 flex flex-col items-center justify-center gap-3">
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
                Save up to 17% with yearly billing
              </span>
            </div>
          </div>
        </div>

        {/* Pricing Cards Grid (4 Plans) */}
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 items-stretch">
          {plans.map((plan) => {
            const monthlyPrice = Number(plan.monthlyPrice ?? plan.price ?? 0);
            const yearlyPrice = Number(plan.yearlyPrice ?? (monthlyPrice * 10));
            const isFree = monthlyPrice === 0;
            const price = billingCycle === "yearly" ? yearlyPrice : monthlyPrice;
            const isPopular = plan.isPopular || plan.slug === "pro";

            // Dynamic savings calculation
            const monthlyEquivalent = monthlyPrice * 12;
            const yearlySavings = monthlyEquivalent - yearlyPrice;
            const savingsPercent = monthlyEquivalent > 0 ? Math.round((yearlySavings / monthlyEquivalent) * 100) : 0;

            const ctaHref = isFree
              ? (isLoggedIn ? "/dashboard" : "/signup")
              : `/signup?plan=${plan.slug}&cycle=${billingCycle}`;

            return (
              <div
                key={plan.slug || plan.name}
                className={`relative flex flex-col justify-between rounded-3xl border p-7 transition-all duration-300 ${
                  isPopular
                    ? "z-10 border-primary bg-primary/[0.04] shadow-[0_0_40px_rgba(22,199,132,0.18)] ring-2 ring-primary/60 lg:-translate-y-2"
                    : "border-foreground/10 bg-foreground/[0.02] hover:border-primary/40 hover:bg-foreground/[0.04] shadow-lg"
                }`}
              >
                {isPopular && (
                  <div className="absolute left-1/2 -top-3.5 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary px-4 py-1 text-[11px] font-black uppercase tracking-wider text-background shadow-md">
                    <Star className="h-3.5 w-3.5 fill-current" />
                    {plan.badgeText || "MOST POPULAR"}
                  </div>
                )}

                <div>
                  {/* Title & Description */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-2xl font-black text-foreground tracking-tight">{plan.name}</h3>
                      {plan.activeDeviceLimit && (
                        <span className="text-[10px] font-semibold text-foreground/50 border border-foreground/10 px-2 py-0.5 rounded-full">
                          {plan.activeDeviceLimit} {plan.activeDeviceLimit > 1 ? "devices" : "device"}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-foreground/60 min-h-[34px] leading-relaxed">
                      {plan.description}
                    </p>
                  </div>

                  <div className="h-px bg-foreground/10 my-4" />

                  {/* Price Block */}
                  <div className="my-5">
                    <div className="flex items-baseline gap-1 text-foreground">
                      <span className="text-4xl font-black tracking-tight">
                        {isFree ? "৳0" : `৳${price.toLocaleString()}`}
                      </span>
                      <span className="text-xs font-semibold text-foreground/50">
                        {isFree ? "Forever" : (billingCycle === "yearly" ? "/ year" : "/ month")}
                      </span>
                    </div>

                    {/* Dynamic Yearly Savings */}
                    {billingCycle === "yearly" && !isFree && yearlySavings > 0 && (
                      <p className="mt-1.5 text-xs font-bold text-primary flex items-center gap-1">
                        <Zap className="h-3.5 w-3.5" /> Save ৳{yearlySavings.toLocaleString()} ({savingsPercent}% off)
                      </p>
                    )}

                    {/* Credits Allocation & Quotas */}
                    <div className="mt-3 space-y-1.5">
                      <div className="inline-flex items-center gap-1.5 rounded-xl border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                        <Sparkles className="h-3.5 w-3.5" />
                        {plan.monthlyCredits.toLocaleString()} AI Credits / mo
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-foreground/60 px-1">
                        <span>Batch: <strong className="text-foreground">{plan.batchLimit || (isFree ? 5 : 25)} files</strong></span>
                        <span>BG Remover: <strong className="text-foreground">{plan.bgRemovalLimit || (isFree ? 3 : 50)}/mo</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* CTA Button */}
                  {isFree || !isLoggedIn ? <Link
                    href={ctaHref}
                    className={`mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-bold transition-all ${
                      isPopular
                        ? "bg-primary text-background shadow-lg shadow-primary/30 hover:bg-primary-hover active:scale-[0.98]"
                        : "border border-primary/30 text-primary hover:bg-primary/10 active:scale-[0.98]"
                    }`}
                  >
                    <span>{plan.ctaText || (isFree ? "Get Started Free" : "Start Creating")}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link> : <button
                    type="button"
                    onClick={() => { setPaymentMessage(""); setCheckoutPlan(plan); }}
                    className={`mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-bold transition-all ${isPopular ? "bg-primary text-background shadow-lg shadow-primary/30 hover:bg-primary-hover active:scale-[0.98]" : "border border-primary/30 text-primary hover:bg-primary/10 active:scale-[0.98]"}`}
                  >
                    <span>{plan.ctaText || "Start Creating"}</span><ArrowRight className="h-4 w-4" />
                  </button>}

                  {/* Explicit Features List */}
                  <div className="mt-6 space-y-2.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-foreground/40">
                      Features Included:
                    </p>
                    {plan.features.slice(0, 11).map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-xs font-medium text-foreground/80">
                        <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5 stroke-[2.5]" />
                        <span>{feat}</span>
                      </div>
                    ))}
                    {plan.features.length > 11 && (
                      <p className="text-[11px] text-foreground/50 font-medium pl-6">
                        + {plan.features.length - 11} more capabilities
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-6 mt-4 border-t border-foreground/5 text-center text-[11px] text-foreground/40 font-medium">
                  {isFree ? "No credit card required" : (plan.creditRolloverEnabled ? "Includes credit rollover" : "Instant activation")}
                </div>
              </div>
            );
          })}
        </div>

        {paymentMessage ? <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-center text-sm font-bold text-primary">Payment submitted successfully. Payment ID: {paymentMessage}. Verification is pending.</div> : null}

        {checkoutPlan ? <PaymentCheckoutModal plan={checkoutPlan} billingCycle={billingCycle} onClose={() => setCheckoutPlan(null)} onSubmitted={(paymentId) => { setPaymentMessage(paymentId); setCheckoutPlan(null); }} /> : null}

        {/* Feature Comparison Section */}
        <div className="mx-auto max-w-6xl rounded-3xl border border-foreground/10 bg-foreground/[0.02] p-6 sm:p-10 space-y-8 shadow-xl">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-foreground/5 px-3 py-1 text-xs font-semibold text-foreground/70">
              <Layers className="h-4 w-4 text-primary" /> Official Feature Matrix
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-foreground">
              Compare plans
            </h2>
            <p className="text-xs sm:text-sm text-foreground/60 max-w-xl mx-auto">
              Everything you need to understand exactly what is included across each MCUSTOCK tier.
            </p>
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

        {/* Pricing FAQ Section */}
        <div className="mx-auto max-w-4xl rounded-3xl border border-foreground/10 bg-foreground/[0.02] p-6 sm:p-10 space-y-6 shadow-xl">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-foreground flex items-center justify-center gap-2">
              <HelpCircle className="h-6 w-6 text-primary" /> Frequently Asked Questions
            </h2>
            <p className="text-xs sm:text-sm text-foreground/60">Everything you need to know about credits, renewals, and features.</p>
          </div>

          <div className="space-y-3 max-w-3xl mx-auto pt-2">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] overflow-hidden transition-colors"
                >
                  <button
                    onClick={() => toggleFaq(idx)}
                    className="w-full p-4 text-left font-bold text-xs sm:text-sm flex items-center justify-between gap-4 text-foreground hover:text-primary transition-colors"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-180 text-primary" : "text-foreground/40"}`} />
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="px-4 pb-4 text-xs sm:text-sm text-foreground/70 leading-relaxed border-t border-foreground/5 pt-3"
                      >
                        {faq.a}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom CTA Banner */}
        <div className="mx-auto max-w-5xl rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-background to-primary/5 p-8 sm:p-12 text-center space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-3 max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">
              Ready to build faster?
            </h2>
            <p className="text-sm sm:text-base text-foreground/70 leading-relaxed">
              Turn your stock workflow into a streamlined AI-powered production system.
            </p>
          </div>

          <div className="relative z-10 flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link
              href={isLoggedIn ? "/dashboard" : "/signup"}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-xs sm:text-sm font-bold text-background shadow-lg shadow-primary/25 hover:bg-primary-hover active:scale-[0.98] transition-all"
            >
              <Sparkles className="h-4 w-4" />
              <span>Start Creating Free</span>
            </Link>

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-2xl border border-foreground/15 bg-foreground/5 px-6 py-3.5 text-xs sm:text-sm font-bold text-foreground hover:bg-foreground/10 active:scale-[0.98] transition-all"
            >
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>Explore Platform</span>
            </Link>
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}

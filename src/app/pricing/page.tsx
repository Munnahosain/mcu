import { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Sparkles, Star } from "lucide-react";
import MarketingChrome from "../../components/MarketingChrome";
import MarketingFooter from "../../components/MarketingFooter";

export const metadata: Metadata = {
  title: "Pricing | MCUSTOCK AI",
  description: "Simple, transparent pricing for stock creators of all sizes.",
};

const tiers = [
  {
    name: "Free",
    price: "$0",
    description: "Perfect for beginners testing the waters.",
    features: [
      "50 image metadata generations/month",
      "Basic SEO keywords",
      "CSV exports for Adobe Stock",
      "Standard support",
    ],
    cta: "Start Free",
    ctaLink: "/signup",
    popular: false,
    icon: "Drop 01",
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    description: "Everything a professional creator needs.",
    features: [
      "Unlimited metadata generations",
      "Advanced AI prompt generation",
      "All CSV formats",
      "AI file renamer",
      "Keyword optimization engine",
      "Priority email support",
    ],
    cta: "Get Pro",
    ctaLink: "/signup?plan=pro",
    popular: true,
    icon: "Flow 02",
  },
  {
    name: "Agency",
    price: "$99",
    period: "/month",
    description: "For teams and high-volume studios.",
    features: [
      "Everything in Pro",
      "API access for custom workflows",
      "Team collaboration",
      "Custom CSV export formats",
      "Dedicated account manager",
      "Early feature access",
    ],
    cta: "Contact Sales",
    ctaLink: "/signup",
    popular: false,
    icon: "Studio 03",
  },
];

export default function PricingPage() {
  return (
    <div className="liquid-page-shell min-h-screen pt-28 bg-background text-foreground">
      <MarketingChrome activePath="/pricing" />
      <main className="mx-auto max-w-7xl space-y-16 px-4 pb-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-6 text-center">
          <div className="flex justify-center">
            <div className="liquid-badge border border-primary/20 bg-primary/5 text-primary text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
              <Sparkles className="h-4 w-4" />
              Annual plans are discounted
            </div>
          </div>
          <h1 className="liquid-title text-4xl font-extrabold tracking-tight md:text-6xl text-primary">
            Simple, Transparent Pricing
          </h1>
          <p className="liquid-copy text-lg md:text-xl text-primary/80">
            Choose the plan that matches your portfolio scale. No clutter, no
            hidden fees, just a smoother workflow as you grow.
          </p>
        </div>

        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 pt-8 md:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`liquid-card border border-primary/20 rounded-3xl relative flex flex-col overflow-hidden p-8 bg-background ${
                tier.popular ? "z-10 md:scale-105 border-primary" : ""
              }`}
            >
              {tier.popular ? (
                <div className="absolute left-1/2 top-0 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold uppercase tracking-[0.25em] text-background shadow-lg">
                  <Star className="h-4 w-4" />
                  Most Popular
                </div>
              ) : null}

              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h2 className="liquid-title mb-2 text-2xl font-semibold text-primary">
                    {tier.name}
                  </h2>
                  <p className="liquid-copy text-sm text-primary/80">{tier.description}</p>
                </div>
                <span className="relative mb-6 rounded-xl border border-primary/10 flex items-center justify-center bg-primary/5 text-primary px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em]">
                  {tier.icon}
                </span>
              </div>

              <div className="h-px bg-primary/10 my-6" />

              <div className="my-6 flex items-end gap-2 text-primary">
                <span className="liquid-title text-5xl font-extrabold tracking-tight">
                  {tier.price}
                </span>
                {tier.period ? (
                  <span className="liquid-copy pb-1 font-medium">{tier.period}</span>
                ) : null}
              </div>

              <Link
                href={tier.ctaLink}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
                  tier.popular ? "bg-primary text-background" : "border border-primary/30 text-primary hover:bg-primary/5"
                }`}
              >
                {tier.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>

              <div className="mt-8 space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-primary/60">
                  What&apos;s included
                </p>
                {tier.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3 text-sm text-primary/80">
                    <span className="mt-0.5 h-5 w-5 rounded-full border border-primary/20 bg-primary/5 text-primary flex items-center justify-center shrink-0">
                      <Check className="h-3 w-3" />
                    </span>
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mx-auto max-w-3xl pt-8 text-center">
          <h2 className="liquid-title mb-4 text-3xl font-bold text-primary">Questions?</h2>
          <p className="liquid-copy text-primary/80 text-sm">
            You can compare setup details in the{" "}
            <Link href="/docs" className="font-bold text-primary hover:underline">
              documentation
            </Link>{" "}
            or register an account and test the flow on the free tier.
          </p>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}

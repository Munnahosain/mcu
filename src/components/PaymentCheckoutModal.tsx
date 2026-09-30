"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Copy, AlertCircle, Loader2, X, ShieldCheck } from "lucide-react";

export type CheckoutPlan = {
  _id?: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  price?: number;
  monthlyCredits: number;
};

type PaymentCheckoutModalProps = {
  plan: CheckoutPlan;
  billingCycle: "monthly" | "yearly";
  onClose: () => void;
  onSubmitted: (paymentId: string) => void;
};

type ProviderRule = {
  key: string;
  name: string;
  txIdLengthHint: string;
  txIdExample: string;
  txIdPatternStr: string;
  senderPlaceholder: string;
  senderHint: string;
  senderPatternStr: string;
};

type Settings = {
  provider: "bkash" | "nagad" | "rocket" | "upay";
  enabled: boolean;
  paymentMethod: string;
  accountNumber: string;
  accountType: "merchant" | "personal" | "agent";
  instructions: string;
  minimumAmount: number;
  maximumAmount: number | null;
};

const PROVIDER_THEMES: Record<
  string,
  { name: string; color: string; badgeClass: string; bgClass: string; borderClass: string }
> = {
  bkash: {
    name: "bKash",
    color: "#E2136E",
    badgeClass: "bg-pink-500/15 text-pink-400 border-pink-500/30",
    bgClass: "from-pink-950/20 to-transparent",
    borderClass: "border-pink-500/30",
  },
  nagad: {
    name: "Nagad",
    color: "#F7931E",
    badgeClass: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    bgClass: "from-orange-950/20 to-transparent",
    borderClass: "border-orange-500/30",
  },
  rocket: {
    name: "Rocket",
    color: "#8C3494",
    badgeClass: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    bgClass: "from-purple-950/20 to-transparent",
    borderClass: "border-purple-500/30",
  },
  upay: {
    name: "Upay",
    color: "#00A3E0",
    badgeClass: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
    bgClass: "from-cyan-950/20 to-transparent",
    borderClass: "border-cyan-500/30",
  },
};

export default function PaymentCheckoutModal({ plan, billingCycle, onClose, onSubmitted }: PaymentCheckoutModalProps) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [rules, setRules] = useState<Record<string, ProviderRule>>({});
  const [senderNumber, setSenderNumber] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const amount = billingCycle === "yearly" ? Number(plan.yearlyPrice ?? plan.price ?? 0) : Number(plan.monthlyPrice ?? plan.price ?? 0);

  useEffect(() => {
    fetch("/api/payments/settings")
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          setSettings(data.settings);
          if (data.rules) setRules(data.rules);
        }
      })
      .catch(() => setSettings(null))
      .finally(() => setLoading(false));
  }, []);

  const activeProviderKey = settings?.provider || "bkash";
  const activeRule = rules[activeProviderKey] || {
    key: activeProviderKey,
    name: PROVIDER_THEMES[activeProviderKey]?.name || activeProviderKey,
    txIdLengthHint: "10 alphanumeric characters",
    txIdExample: "8A7B6C5D4E",
    txIdPatternStr: "^[0-9A-Z]{10}$",
    senderPlaceholder: "017XXXXXXXX",
    senderHint: "11 digits starting with 013-019",
    senderPatternStr: "^01[3-9]\\d{8}$",
  };

  const theme = PROVIDER_THEMES[activeProviderKey] || PROVIDER_THEMES.bkash;

  // Validation logic
  const isTxIdValid = useMemo(() => {
    if (!transactionId) return false;
    try {
      const regex = new RegExp(activeRule.txIdPatternStr, "i");
      return regex.test(transactionId.trim());
    } catch {
      return transactionId.trim().length >= 8;
    }
  }, [transactionId, activeRule.txIdPatternStr]);

  const isSenderValid = useMemo(() => {
    if (!senderNumber) return false;
    try {
      const regex = new RegExp(activeRule.senderPatternStr);
      return regex.test(senderNumber.trim());
    } catch {
      return senderNumber.trim().length === 11;
    }
  }, [senderNumber, activeRule.senderPatternStr]);

  const handleTxIdChange = (value: string) => {
    // Force uppercase and remove non-alphanumeric characters
    const clean = value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 16);
    setTransactionId(clean);
  };

  const handleSenderChange = (value: string) => {
    // Only numbers, max 12 digits (Rocket allows 12 digits)
    const clean = value.replace(/[^0-9]/g, "").slice(0, 12);
    setSenderNumber(clean);
  };

  const submit = async () => {
    if (!plan._id || !termsAccepted || !isTxIdValid || !isSenderValid) return;
    setProcessing(true);
    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan._id,
          billingInterval: billingCycle === "yearly" ? "year" : "month",
          senderNumber: senderNumber.trim(),
          transactionId: transactionId.trim(),
          termsAccepted,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Payment submission failed.");
      onSubmitted(data.payment.paymentId);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Payment submission failed.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-title"
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-primary/25 bg-background p-5 text-foreground shadow-2xl sm:p-7">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-foreground/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 id="checkout-title" className="text-xl font-black">
                Secure Checkout
              </h2>
              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${theme.badgeClass}`}>
                {theme.name}
              </span>
            </div>
            <p className="mt-1 text-xs text-foreground/60">
              Subscribing to <strong className="text-foreground">{plan.name}</strong> plan ({billingCycle}) for{" "}
              <strong className="text-primary">৳{amount.toLocaleString()}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close checkout"
            className="rounded-full p-2 text-foreground/55 transition hover:bg-foreground/10 hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Status / Notice */}
        {loading ? (
          <div className="my-8 flex items-center justify-center gap-2 text-xs text-foreground/60">
            <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading payment provider details...
          </div>
        ) : !settings?.enabled ? (
          <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2 font-bold">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <span>{theme.name} payment is temporarily unavailable</span>
            </div>
            <p className="mt-1 text-[11px] text-foreground/60">
              Admin has not configured or enabled this payment provider yet. Please check back later or contact support.
            </p>
          </div>
        ) : null}

        {/* Content */}
        {settings?.enabled && (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {/* Step 1: Transfer Info */}
            <section className={`rounded-2xl border bg-gradient-to-b ${theme.bgClass} ${theme.borderClass} p-4`}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-wider text-primary">1. Send Money</p>
                <span className="rounded-md border border-foreground/15 bg-background/50 px-2 py-0.5 text-[10px] font-semibold uppercase text-foreground/80">
                  {settings.accountType}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <span className="text-[11px] text-foreground/60">Send Money / Payment To:</span>
                  <div className="mt-1 flex items-center justify-between rounded-xl border border-foreground/15 bg-background/80 px-3 py-2 text-sm font-mono font-bold text-foreground">
                    <span>{settings.accountNumber || "Not configured"}</span>
                    {settings.accountNumber && (
                      <button
                        type="button"
                        aria-label="Copy Account Number"
                        onClick={() => {
                          void navigator.clipboard.writeText(settings.accountNumber);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1500);
                        }}
                        className="rounded-lg border border-primary/30 bg-primary/10 p-1.5 text-primary hover:bg-primary/20"
                      >
                        {copied ? <span className="text-xs font-bold text-emerald-500">Copied!</span> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-foreground/60">Exact Amount:</span>
                  <div className="mt-1 rounded-xl border border-foreground/15 bg-background/80 px-3 py-2 text-base font-black text-primary">
                    ৳{amount.toLocaleString()} <span className="text-xs font-normal text-foreground/60">BDT</span>
                  </div>
                </div>

                {settings.instructions && (
                  <div className="rounded-xl border border-foreground/10 bg-background/40 p-2.5">
                    <p className="text-[11px] font-semibold text-foreground/70">Instructions:</p>
                    <p className="mt-1 whitespace-pre-line text-[11px] leading-relaxed text-foreground/60">
                      {settings.instructions}
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Step 2: Verification */}
            <section className="flex flex-col justify-between rounded-2xl border border-foreground/10 bg-foreground/[0.04] p-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-primary">2. Verify Transaction</p>

                {/* Sender Number */}
                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground/80">Your Mobile Number</label>
                    {senderNumber.length > 0 && (
                      <span className="text-[10px] font-mono text-foreground/50">
                        {senderNumber.length} {senderNumber.length === 11 ? "digits" : "digits"}
                      </span>
                    )}
                  </div>
                  <div className="relative mt-1.5">
                    <input
                      type="tel"
                      value={senderNumber}
                      onChange={(e) => handleSenderChange(e.target.value)}
                      placeholder={activeRule.senderPlaceholder}
                      className={`w-full rounded-xl border bg-background px-3 py-2.5 pr-8 text-sm font-mono text-foreground outline-none transition focus:border-primary ${
                        senderNumber.length > 0
                          ? isSenderValid
                            ? "border-emerald-500/60 focus:border-emerald-500"
                            : "border-rose-500/60 focus:border-rose-500"
                          : "border-foreground/15"
                      }`}
                    />
                    {senderNumber.length > 0 && (
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                        {isSenderValid ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-rose-500" />
                        )}
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-[10px] text-foreground/50">{activeRule.senderHint}</p>
                </div>

                {/* Transaction ID */}
                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground/80">Transaction ID (TrxID)</label>
                    <span className="text-[10px] font-mono text-foreground/50">
                      {transactionId.length > 0 ? `${transactionId.length} chars` : activeRule.txIdLengthHint}
                    </span>
                  </div>
                  <div className="relative mt-1.5">
                    <input
                      type="text"
                      value={transactionId}
                      onChange={(e) => handleTxIdChange(e.target.value)}
                      placeholder={`e.g. ${activeRule.txIdExample}`}
                      className={`w-full rounded-xl border bg-background px-3 py-2.5 pr-8 text-sm font-mono uppercase tracking-wider text-foreground outline-none transition focus:border-primary ${
                        transactionId.length > 0
                          ? isTxIdValid
                            ? "border-emerald-500/60 focus:border-emerald-500"
                            : "border-rose-500/60 focus:border-rose-500"
                          : "border-foreground/15"
                      }`}
                    />
                    {transactionId.length > 0 && (
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                        {isTxIdValid ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-rose-500" />
                        )}
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-[10px] text-foreground/50">
                    Format: {activeRule.txIdLengthHint} (Uppercase letters & digits)
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-1.5 text-[11px] text-foreground/50">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                <span>Encrypted & verified against fraudulent duplicate IDs</span>
              </div>
            </section>
          </div>
        )}

        {/* Terms and Actions */}
        <div className="mt-5 border-t border-foreground/10 pt-4">
          <label className="flex cursor-pointer items-start gap-2.5 text-xs text-foreground/75">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded accent-primary"
            />
            <span>
              I have sent the exact amount (৳{amount.toLocaleString()}) via {theme.name} and confirm that the provided
              Sender Number and TrxID are correct.
            </span>
          </label>

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-foreground/15 px-4 py-3 text-xs font-bold text-foreground/70 transition hover:bg-foreground/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={
                processing ||
                !settings?.enabled ||
                !plan._id ||
                !isSenderValid ||
                !isTxIdValid ||
                !termsAccepted
              }
              className="inline-flex flex-[2] items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold text-background transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Verifying & Submitting...
                </>
              ) : (
                "Confirm & Submit Payment"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

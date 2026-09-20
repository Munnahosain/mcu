"use client";

import { useEffect, useState } from "react";
import { Copy, Loader2, X } from "lucide-react";

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

type Settings = { enabled: boolean; accountNumber: string; accountType: string; instructions: string };

export default function PaymentCheckoutModal({ plan, billingCycle, onClose, onSubmitted }: PaymentCheckoutModalProps) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [senderNumber, setSenderNumber] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const amount = billingCycle === "yearly" ? Number(plan.yearlyPrice ?? plan.price ?? 0) : Number(plan.monthlyPrice ?? plan.price ?? 0);

  useEffect(() => {
    fetch("/api/payments/settings").then((response) => response.json()).then((data) => { if (data.success) setSettings(data.settings); }).catch(() => setSettings(null));
  }, []);

  const submit = async () => {
    if (!plan._id || !termsAccepted) return;
    setProcessing(true);
    try {
      const response = await fetch("/api/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId: plan._id, billingInterval: billingCycle === "yearly" ? "year" : "month", senderNumber, transactionId, termsAccepted }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Payment submission failed.");
      onSubmitted(data.payment.paymentId);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Payment submission failed.");
    } finally { setProcessing(false); }
  };

  return <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
    <div className="w-full max-w-2xl rounded-3xl border border-primary/25 bg-background p-5 text-foreground shadow-2xl sm:p-7">
      <div className="flex items-start justify-between gap-4 border-b border-foreground/10 pb-4"><div><h2 id="checkout-title" className="text-xl font-black">Secure Checkout</h2><p className="mt-1 text-xs text-foreground/60">You are subscribing to the {plan.name} plan for ৳{amount.toLocaleString()}.</p></div><button type="button" onClick={onClose} aria-label="Close checkout" className="rounded-full p-2 text-foreground/55 hover:bg-foreground/10 hover:text-foreground"><X className="h-5 w-5" /></button></div>
      {!settings?.enabled ? <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">bKash payment is temporarily unavailable.</div> : null}
      <div className="mt-5 grid gap-4 sm:grid-cols-2"><section className="rounded-2xl border border-foreground/10 bg-foreground/[0.04] p-4"><p className="text-xs font-black uppercase tracking-wider text-primary">1. Send Money</p><p className="mt-4 text-xs text-foreground/60">Provider<strong className="mt-1 block text-foreground">bKash ({settings?.accountType || "merchant"})</strong></p><p className="mt-3 text-xs text-foreground/60">Number<strong className="mt-1 flex items-center gap-2 text-foreground">{settings?.accountNumber || "Not configured"}<button type="button" aria-label="Copy bKash number" onClick={() => { if (settings?.accountNumber) { void navigator.clipboard.writeText(settings.accountNumber); setCopied(true); setTimeout(() => setCopied(false), 1200); } }} className="rounded-lg border border-primary/30 p-1.5 text-primary">{copied ? "✓" : <Copy className="h-3.5 w-3.5" />}</button></strong></p><p className="mt-3 text-xs text-foreground/60">Amount<strong className="mt-1 block text-lg text-foreground">৳{amount.toLocaleString()}</strong></p>{settings?.instructions ? <p className="mt-4 whitespace-pre-line text-[11px] leading-relaxed text-foreground/60">{settings.instructions}</p> : null}</section><section className="rounded-2xl border border-foreground/10 bg-foreground/[0.04] p-4"><p className="text-xs font-black uppercase tracking-wider text-primary">2. Verify Payment</p><label className="mt-4 block text-xs font-semibold text-foreground/70">Sender Number (Your Number)<input value={senderNumber} onChange={(event) => setSenderNumber(event.target.value)} placeholder="017XXXXXXXX" className="mt-2 w-full rounded-xl border border-foreground/15 bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary" /></label><label className="mt-4 block text-xs font-semibold text-foreground/70">Transaction ID (TrxID)<input value={transactionId} onChange={(event) => setTransactionId(event.target.value)} placeholder="8A7B6C5D4E" className="mt-2 w-full rounded-xl border border-foreground/15 bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary" /></label></section></div>
      <label className="mt-5 flex items-start gap-2 text-xs text-foreground/70"><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} className="mt-0.5 accent-primary" /> I accept the Terms and Conditions</label><div className="mt-6 flex gap-3"><button type="button" onClick={onClose} className="flex-1 rounded-xl border border-foreground/15 px-4 py-3 text-xs font-bold text-foreground/70 hover:bg-foreground/5">Cancel</button><button type="button" onClick={() => void submit()} disabled={processing || !settings?.enabled || !plan._id || !senderNumber || !transactionId || !termsAccepted} className="flex-[2] inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold text-background disabled:cursor-not-allowed disabled:opacity-50">{processing ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</> : "Confirm Payment"}</button></div>
    </div>
  </div>;
}

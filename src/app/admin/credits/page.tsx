"use client";

import { useState, useEffect, FormEvent } from "react";
import {
  Coins,
  Save,
  UserPlus,
  Loader2,
  Check,
  AlertCircle,
  Sparkles,
  ShieldAlert,
} from "lucide-react";

interface ICreditCosts {
  metadata_generation: number;
  prompt_generation: number;
  advanced_metadata: number;
  batch_generation: number;
  advanced_ai: number;
  heavy_ai: number;
  background_removal: number;
  three_d_generation: number;
  grid_generation: number;
  palette_generation: number;
  typebox_generation: number;
  bento_generation: number;
  ascii_generation: number;
  trading_generation: number;
  splitter_export: number;
  byo_api_mode: string;
}

const studioCostFields: Array<{ key: keyof ICreditCosts; label: string }> = [
  { key: "three_d_generation", label: "3D Studio" },
  { key: "grid_generation", label: "Grid Generator" },
  { key: "palette_generation", label: "Palette Studio" },
  { key: "typebox_generation", label: "Typebox Studio" },
  { key: "bento_generation", label: "Bento Lab" },
  { key: "ascii_generation", label: "ASCII Studio" },
  { key: "trading_generation", label: "Trading Charts" },
  { key: "splitter_export", label: "Vector Splitter Export" },
];

export default function AdminCreditsPage() {
  const [costs, setCosts] = useState<ICreditCosts>({
    metadata_generation: 1,
    prompt_generation: 1,
    advanced_metadata: 2,
    batch_generation: 1,
    advanced_ai: 2,
    heavy_ai: 5,
    background_removal: 5,
    three_d_generation: 1,
    grid_generation: 1,
    palette_generation: 1,
    typebox_generation: 1,
    bento_generation: 1,
    ascii_generation: 1,
    trading_generation: 1,
    splitter_export: 1,
    byo_api_mode: "charge",
  });
  const [loading, setLoading] = useState(true);
  const [savingCosts, setSavingCosts] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Manual User Adjustment Form
  const [targetUserId, setTargetUserId] = useState("");
  const [adjustAmount, setAdjustAmount] = useState("100");
  const [adjustReason, setAdjustReason] = useState("Promotional Bonus");
  const [adjustingUser, setAdjustingUser] = useState(false);
  const [adjustFeedback, setAdjustFeedback] = useState("");

  useEffect(() => {
    fetch("/api/admin/credits", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.creditCosts) {
          setCosts((prev) => ({ ...prev, ...data.creditCosts }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSaveCosts = async (e: FormEvent) => {
    e.preventDefault();
    setSavingCosts(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/admin/credits", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creditCosts: costs }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to update costs");
      setMessage("Credit costs updated and applied server-side!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update costs");
    } finally {
      setSavingCosts(false);
    }
  };

  const handleManualAdjustment = async (e: FormEvent) => {
    e.preventDefault();
    setAdjustingUser(true);
    setAdjustFeedback("");

    try {
      const res = await fetch("/api/admin/credits", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "adjust_user",
          userId: targetUserId.trim(),
          amount: Number(adjustAmount),
          reason: adjustReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Adjustment failed");
      setAdjustFeedback(`Success: ${data.message} (New Balance: ${data.user.balance})`);
      setTargetUserId("");
    } catch (err) {
      setAdjustFeedback(`Error: ${err instanceof Error ? err.message : "Adjustment failed"}`);
    } finally {
      setAdjustingUser(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Header */}
      <div className="border-b border-white/10 pb-6">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">
          Economy &amp; Metering Controls
        </p>
        <h1 className="mt-1 text-3xl font-black text-white flex items-center gap-3">
          <Coins className="h-8 w-8 text-primary" />
          <span>Credit Cost &amp; Metering Management</span>
        </h1>
        <p className="mt-1 text-sm text-white/55">
          Configure server-side credit deduction costs for each AI operation and manually adjust user balances.
        </p>
      </div>

      {message && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm text-primary flex items-center gap-2">
          <Check className="h-4 w-4" /> {message}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Cost Configuration Form */}
        <form
          onSubmit={handleSaveCosts}
          className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8 backdrop-blur-xl space-y-6 shadow-xl"
        >
          <div className="flex items-center gap-2 text-base font-bold text-white">
            <Sparkles className="h-5 w-5 text-primary" />
            <span>AI Operation Costs (Credits per execution)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block text-xs font-semibold text-white/60">
              Metadata Generation
              <input
                type="number"
                min="0"
                value={costs.metadata_generation}
                onChange={(e) => setCosts({ ...costs, metadata_generation: Number(e.target.value) })}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none focus:border-primary"
              />
            </label>

            <label className="block text-xs font-semibold text-white/60">
              Prompt Generation
              <input
                type="number"
                min="0"
                value={costs.prompt_generation}
                onChange={(e) => setCosts({ ...costs, prompt_generation: Number(e.target.value) })}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none focus:border-primary"
              />
            </label>

            <label className="block text-xs font-semibold text-white/60">
              Advanced Metadata (SEO)
              <input
                type="number"
                min="0"
                value={costs.advanced_metadata}
                onChange={(e) => setCosts({ ...costs, advanced_metadata: Number(e.target.value) })}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none focus:border-primary"
              />
            </label>

            <label className="block text-xs font-semibold text-white/60">
              Batch Item Rate
              <input
                type="number"
                min="0"
                value={costs.batch_generation}
                onChange={(e) => setCosts({ ...costs, batch_generation: Number(e.target.value) })}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none focus:border-primary"
              />
            </label>

            <label className="block text-xs font-semibold text-white/60">
              Advanced AI Operation
              <input
                type="number"
                min="0"
                value={costs.advanced_ai}
                onChange={(e) => setCosts({ ...costs, advanced_ai: Number(e.target.value) })}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none focus:border-primary"
              />
            </label>

            <label className="block text-xs font-semibold text-white/60">
              Heavy AI Operation
              <input
                type="number"
                min="0"
                value={costs.heavy_ai}
                onChange={(e) => setCosts({ ...costs, heavy_ai: Number(e.target.value) })}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none focus:border-primary"
              />
            </label>

            <label className="block text-xs font-semibold text-white/60 sm:col-span-2">
              Background Removal (4K Matting)
              <input
                type="number"
                min="0"
                value={costs.background_removal}
                onChange={(e) => setCosts({ ...costs, background_removal: Number(e.target.value) })}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none focus:border-primary"
              />
            </label>
          </div>

          <div className="space-y-3 border-t border-white/10 pt-4">
            <div>
              <p className="text-sm font-bold text-white">Studio &amp; Tool Costs</p>
              <p className="mt-1 text-[11px] text-white/45">Default rates for tool actions that are connected to server-side metering.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {studioCostFields.map(({ key, label }) => (
                <label key={key} className="block text-xs font-semibold text-white/60">
                  {label}
                  <input
                    type="number"
                    min="0"
                    value={costs[key] as number}
                    onChange={(event) => setCosts({ ...costs, [key]: Number(event.target.value) })}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none focus:border-primary"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* BYO Key Mode */}
          <div className="pt-2 border-t border-white/10 space-y-2">
            <label className="block text-xs font-semibold text-white/60">
              BYO API Key Credit Mode
              <select
                value={costs.byo_api_mode}
                onChange={(e) => setCosts({ ...costs, byo_api_mode: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none focus:border-primary"
              >
                <option value="charge" className="bg-[#081b16] text-white">Charge standard credits (Recommended)</option>
                <option value="reduced" className="bg-[#081b16] text-white">Reduced credits (50% discount)</option>
                <option value="free" className="bg-[#081b16] text-white">No credits (Free when user provides key)</option>
              </select>
            </label>
            <p className="text-[11px] text-white/40">
              Determines whether users who bring their own Groq/Gemini/OpenAI keys consume MCUSTOCK platform credits.
            </p>
          </div>

          <button
            type="submit"
            disabled={savingCosts}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-xs font-bold text-[#06251b] hover:bg-primary-hover active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
          >
            {savingCosts ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>Save Credit Costs Configuration</span>
          </button>
        </form>

        {/* Manual Credit Adjustment Form */}
        <div className="space-y-6">
          <form
            onSubmit={handleManualAdjustment}
            className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8 backdrop-blur-xl space-y-5 shadow-xl"
          >
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <UserPlus className="h-5 w-5 text-primary" />
              <span>Manual User Credit Adjustment</span>
            </div>
            <p className="text-xs text-white/50">
              Directly grant bonus credits or deduct credits from a user with full ledger auditing.
            </p>

            <label className="block text-xs font-semibold text-white/60">
              User ID (MongoDB ObjectId) *
              <input
                required
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                placeholder="e.g. 66e8fa12b98f230012abcde4"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none focus:border-primary"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block text-xs font-semibold text-white/60">
                Amount (+ / − Credits) *
                <input
                  type="number"
                  required
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="e.g. 500 or -100"
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none focus:border-primary"
                />
              </label>

              <label className="block text-xs font-semibold text-white/60">
                Reason / Note *
                <input
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Promotional Bonus"
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none focus:border-primary"
                />
              </label>
            </div>

            {adjustFeedback && (
              <div
                className={`p-3 rounded-xl text-xs font-bold ${
                  adjustFeedback.startsWith("Success")
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "bg-red-500/10 text-red-300 border border-red-500/20"
                }`}
              >
                {adjustFeedback}
              </div>
            )}

            <button
              type="submit"
              disabled={adjustingUser}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 py-3 text-xs font-bold text-primary hover:bg-primary/20 active:scale-[0.98] transition-all"
            >
              {adjustingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
              <span>Execute Credit Adjustment</span>
            </button>
          </form>

          {/* Guidelines Box */}
          <div className="rounded-3xl border border-white/5 bg-black/30 p-6 space-y-2 text-xs text-white/50">
            <h3 className="text-white font-bold flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4 text-primary" /> Security &amp; Fail-Safe Rules
            </h3>
            <ul className="list-disc pl-4 space-y-1">
              <li>Never charge credits for failed AI generations. Credits are only deducted on successful returns.</li>
              <li>For batches, only successfully processed items are charged.</li>
              <li>Every credit adjustment is permanently recorded in the credit transaction ledger.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

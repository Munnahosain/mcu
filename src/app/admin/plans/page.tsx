"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Plus,
  Power,
  RotateCcw,
  Edit2,
  Trash2,
  Check,
  Star,
  Sparkles,
  Loader2,
  X,
  CreditCard,
  Shield,
  Smartphone,
} from "lucide-react";

type Plan = {
  _id: string;
  name: string;
  slug: string;
  description?: string;
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
  active: boolean;
  isPublic?: boolean;
  sortOrder?: number;
  features: string[];
};

const defaultPlanForm = {
  name: "",
  slug: "",
  description: "",
  monthlyPrice: "199",
  yearlyPrice: "1990",
  monthlyCredits: "2000",
  batchLimit: "25",
  bgRemovalLimit: "50",
  creditRolloverEnabled: true,
  maxRolloverCredits: "2000",
  activeDeviceLimit: "2",
  badgeText: "",
  isPopular: false,
  ctaText: "Choose Plan",
  active: true,
  isPublic: true,
  features: "AI Metadata Generator, CSV Export, 3D Icon Studio",
};

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultPlanForm);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/plans", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to load plans.");
      setPlans(data.plans || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load plans.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPlans();
  }, []);

  const handleSeedPlans = async () => {
    if (!confirm("Reset and seed official MCUSTOCK Bangladeshi Taka (৳ BDT) plans? This will replace all existing plans with Free, Creator, Pro, and Studio.")) {
      return;
    }

    setActionLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/plans", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to seed plans.");
      setMessage("Official BDT Plans seeded successfully!");
      await loadPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to seed plans.");
    } finally {
      setActionLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingPlanId(null);
    setForm(defaultPlanForm);
    setIsModalOpen(true);
    setError("");
    setMessage("");
  };

  const openEditModal = (plan: Plan) => {
    setEditingPlanId(plan._id);
    setForm({
      name: plan.name,
      slug: plan.slug,
      description: plan.description || "",
      monthlyPrice: String(plan.monthlyPrice ?? plan.price ?? 0),
      yearlyPrice: String(plan.yearlyPrice ?? 0),
      monthlyCredits: String(plan.monthlyCredits || 0),
      batchLimit: String(plan.batchLimit || 5),
      bgRemovalLimit: String(plan.bgRemovalLimit || 3),
      creditRolloverEnabled: Boolean(plan.creditRolloverEnabled),
      maxRolloverCredits: String(plan.maxRolloverCredits || 0),
      activeDeviceLimit: String(plan.activeDeviceLimit || 1),
      badgeText: plan.badgeText || "",
      isPopular: Boolean(plan.isPopular),
      ctaText: plan.ctaText || "Choose Plan",
      active: plan.active,
      isPublic: plan.isPublic !== false,
      features: Array.isArray(plan.features) ? plan.features.join(", ") : "",
    });
    setIsModalOpen(true);
    setError("");
    setMessage("");
  };

  const handleSavePlan = async (e: FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError("");
    setMessage("");

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim().toLowerCase(),
      description: form.description.trim(),
      monthlyPrice: Number(form.monthlyPrice),
      yearlyPrice: Number(form.yearlyPrice),
      monthlyCredits: Number(form.monthlyCredits),
      batchLimit: Number(form.batchLimit),
      bgRemovalLimit: Number(form.bgRemovalLimit),
      creditRolloverEnabled: form.creditRolloverEnabled,
      maxRolloverCredits: Number(form.maxRolloverCredits),
      activeDeviceLimit: Number(form.activeDeviceLimit),
      badgeText: form.badgeText.trim(),
      isPopular: form.isPopular,
      ctaText: form.ctaText.trim(),
      active: form.active,
      isPublic: form.isPublic,
      features: form.features
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean),
    };

    try {
      const url = editingPlanId ? `/api/admin/plans/${editingPlanId}` : "/api/admin/plans";
      const method = editingPlanId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save plan.");

      setMessage(editingPlanId ? "Plan updated successfully." : "Plan created successfully.");
      setIsModalOpen(false);
      await loadPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save plan.");
    } finally {
      setActionLoading(false);
    }
  };

  const togglePlan = async (plan: Plan) => {
    try {
      const res = await fetch(`/api/admin/plans/${plan._id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !plan.active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update plan status.");
      await loadPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update plan status.");
    }
  };

  const deletePlan = async (plan: Plan) => {
    if (!confirm(`Are you sure you want to permanently delete "${plan.name}" plan?`)) return;

    try {
      const res = await fetch(`/api/admin/plans/${plan._id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete plan.");
      setMessage(`Deleted "${plan.name}" plan.`);
      await loadPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete plan.");
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">
            Commercial &amp; Billing Controls
          </p>
          <h1 className="mt-1 text-3xl font-black text-white">Plans Management</h1>
          <p className="mt-1 text-sm text-white/55">
            Manage plans, credit limits, BDT (৳) pricing, and features live from database.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={actionLoading}
            onClick={handleSeedPlans}
            className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-xs font-bold text-primary hover:bg-primary/20 active:scale-[0.98] transition-all"
            title="Wipe & seed official Free, Creator, Pro, Studio plans with BDT pricing"
          >
            <RotateCcw className={`h-4 w-4 ${actionLoading ? "animate-spin" : ""}`} />
            <span>Reset &amp; Seed Official BDT Plans</span>
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-[#06251b] hover:bg-primary-hover active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
          >
            <Plus className="h-4 w-4" />
            <span>Create New Plan</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm text-primary">
          {message}
        </div>
      )}

      {/* Plans List */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/15 p-12 text-center text-sm text-white/45 space-y-4">
          <CreditCard className="mx-auto h-10 w-10 text-primary/50" />
          <div>
            <h3 className="text-base font-bold text-white">No plans configured yet.</h3>
            <p className="mt-1 text-xs text-white/40">
              Click &quot;Reset &amp; Seed Official BDT Plans&quot; above to initialize default Free, Creator, Pro, and Studio tiers.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSeedPlans}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-[#06251b]"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Seed Official Plans
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => {
            const isFree = (plan.monthlyPrice ?? plan.price ?? 0) === 0;
            return (
              <div
                key={plan._id}
                className={`relative flex flex-col justify-between rounded-3xl border p-6 backdrop-blur-xl transition-all ${
                  plan.isPopular
                    ? "border-primary/80 bg-primary/[0.06] shadow-[0_0_30px_rgba(22,199,132,0.15)] ring-1 ring-primary/40"
                    : "border-white/10 bg-white/[0.03] hover:border-primary/30"
                }`}
              >
                {/* Popular Badge */}
                {plan.isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary text-[#06251b] font-black text-[10px] tracking-widest uppercase shadow-md flex items-center gap-1">
                    <Star className="h-3 w-3 fill-current" /> {plan.badgeText || "POPULAR"}
                  </div>
                )}

                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-black text-white">{plan.name}</h3>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                          {plan.slug}
                        </span>
                      </div>
                      <p className="text-xs text-white/50 mt-1 min-h-[32px] line-clamp-2">
                        {plan.description || "No description"}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void togglePlan(plan)}
                      title={plan.active ? "Deactivate plan" : "Activate plan"}
                      className={`rounded-full p-1.5 transition-colors ${
                        plan.active ? "bg-primary/20 text-primary" : "bg-white/10 text-white/40"
                      }`}
                    >
                      <Power className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Pricing Info */}
                  <div className="pt-2 border-t border-white/10 space-y-1">
                    <div className="flex items-baseline gap-1 text-white">
                      <span className="text-2xl font-black">
                        {isFree ? "৳0" : `৳${(plan.monthlyPrice ?? plan.price ?? 0).toLocaleString()}`}
                      </span>
                      <span className="text-xs text-white/50">/ month</span>
                    </div>
                    {!isFree && (
                      <p className="text-xs text-white/40">
                        Yearly: <span className="text-white font-bold">৳{(plan.yearlyPrice ?? 0).toLocaleString()}</span> / yr
                      </p>
                    )}
                  </div>

                  {/* Metrics */}
                  <div className="rounded-2xl bg-black/30 border border-white/5 p-3 space-y-1.5 text-xs">
                    <div className="flex justify-between text-white/60">
                      <span className="flex items-center gap-1">
                        <Sparkles className="h-3.5 w-3.5 text-primary" /> Credits:
                      </span>
                      <span className="font-bold text-white">{(plan.monthlyCredits || 0).toLocaleString()} / mo</span>
                    </div>
                    <div className="flex justify-between text-white/60">
                      <span>Batch Limit:</span>
                      <span className="font-bold text-white">{plan.batchLimit || 5} files</span>
                    </div>
                    <div className="flex justify-between text-white/60">
                      <span>BG Remover:</span>
                      <span className="font-bold text-white">{plan.bgRemovalLimit || 3} / mo</span>
                    </div>
                    <div className="flex justify-between text-white/60">
                      <span className="flex items-center gap-1">
                        <Smartphone className="h-3.5 w-3.5 text-primary" /> Devices:
                      </span>
                      <span className="font-bold text-white">{plan.activeDeviceLimit || 1}</span>
                    </div>
                    <div className="flex justify-between text-white/60">
                      <span className="flex items-center gap-1">
                        <Shield className="h-3.5 w-3.5 text-primary" /> Rollover:
                      </span>
                      <span className="font-bold text-white">
                        {plan.creditRolloverEnabled
                          ? `Up to ${(plan.maxRolloverCredits || 0).toLocaleString()}`
                          : "Disabled"}
                      </span>
                    </div>
                  </div>

                  {/* Features List */}
                  <div className="space-y-1 pt-1">
                    <p className="text-[10px] font-bold uppercase text-white/40">Features ({plan.features?.length || 0}):</p>
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto custom-scrollbar">
                      {(plan.features || []).slice(0, 6).map((feat, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/5 bg-white/[0.03] px-2 py-0.5 text-[11px] text-white/70"
                        >
                          <Check className="h-2.5 w-2.5 text-primary" /> {feat}
                        </span>
                      ))}
                      {(plan.features?.length || 0) > 6 && (
                        <span className="text-[10px] text-white/40 px-1 py-0.5">
                          + {(plan.features?.length || 0) - 6} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(plan)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-bold text-white hover:bg-white/10 transition-colors"
                  >
                    <Edit2 className="h-3.5 w-3.5 text-primary" />
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void deletePlan(plan)}
                    className="p-2 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                    title="Delete plan"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit / Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-3xl border border-white/15 bg-[#081b16] p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <span>{editingPlanId ? `Edit Plan: ${form.name}` : "Create New Plan"}</span>
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block text-xs font-semibold text-white/60">
                  Plan Name *
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none focus:border-primary"
                    placeholder="e.g. Creator"
                  />
                </label>

                <label className="block text-xs font-semibold text-white/60">
                  Slug (unique ID) *
                  <input
                    required
                    disabled={Boolean(editingPlanId)}
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none focus:border-primary disabled:opacity-50"
                    placeholder="e.g. creator"
                  />
                </label>
              </div>

              <label className="block text-xs font-semibold text-white/60">
                Short Description
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none focus:border-primary"
                  placeholder="e.g. For individual creators producing content regularly."
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block text-xs font-semibold text-white/60">
                  Monthly Price (৳ BDT) *
                  <input
                    type="number"
                    min="0"
                    required
                    value={form.monthlyPrice}
                    onChange={(e) => setForm({ ...form, monthlyPrice: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none focus:border-primary"
                  />
                </label>

                <label className="block text-xs font-semibold text-white/60">
                  Yearly Price (৳ BDT) *
                  <input
                    type="number"
                    min="0"
                    required
                    value={form.yearlyPrice}
                    onChange={(e) => setForm({ ...form, yearlyPrice: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none focus:border-primary"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <label className="block text-xs font-semibold text-white/60">
                  Monthly AI Credits *
                  <input
                    type="number"
                    min="0"
                    required
                    value={form.monthlyCredits}
                    onChange={(e) => setForm({ ...form, monthlyCredits: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none focus:border-primary"
                  />
                </label>

                <label className="block text-xs font-semibold text-white/60">
                  Active Device Limit *
                  <input
                    type="number"
                    min="1"
                    required
                    value={form.activeDeviceLimit}
                    onChange={(e) => setForm({ ...form, activeDeviceLimit: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none focus:border-primary"
                  />
                </label>

                <label className="block text-xs font-semibold text-white/60">
                  Max Rollover Credits
                  <input
                    type="number"
                    min="0"
                    value={form.maxRolloverCredits}
                    onChange={(e) => setForm({ ...form, maxRolloverCredits: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none focus:border-primary"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block text-xs font-semibold text-white/60">
                  Batch Limit (files per batch) *
                  <input
                    type="number"
                    min="1"
                    required
                    value={form.batchLimit}
                    onChange={(e) => setForm({ ...form, batchLimit: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none focus:border-primary"
                  />
                </label>

                <label className="block text-xs font-semibold text-white/60">
                  BG Remover Monthly Quota *
                  <input
                    type="number"
                    min="0"
                    required
                    value={form.bgRemovalLimit}
                    onChange={(e) => setForm({ ...form, bgRemovalLimit: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none focus:border-primary"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block text-xs font-semibold text-white/60">
                  Badge Text
                  <input
                    value={form.badgeText}
                    onChange={(e) => setForm({ ...form, badgeText: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none focus:border-primary"
                    placeholder="e.g. MOST POPULAR"
                  />
                </label>

                <label className="block text-xs font-semibold text-white/60">
                  CTA Button Text
                  <input
                    value={form.ctaText}
                    onChange={(e) => setForm({ ...form, ctaText: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none focus:border-primary"
                    placeholder="e.g. Start Creating"
                  />
                </label>
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap gap-6 pt-2">
                <label className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isPopular}
                    onChange={(e) => setForm({ ...form, isPopular: e.target.checked })}
                    className="h-4 w-4 rounded accent-primary"
                  />
                  <span>Is Popular / Highlighted</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.creditRolloverEnabled}
                    onChange={(e) => setForm({ ...form, creditRolloverEnabled: e.target.checked })}
                    className="h-4 w-4 rounded accent-primary"
                  />
                  <span>Credit Rollover Enabled</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                    className="h-4 w-4 rounded accent-primary"
                  />
                  <span>Active</span>
                </label>
              </div>

              {/* Features Comma Separated */}
              <label className="block text-xs font-semibold text-white/60 pt-2">
                Features (comma separated)
                <textarea
                  rows={3}
                  value={form.features}
                  onChange={(e) => setForm({ ...form, features: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-white outline-none focus:border-primary leading-relaxed"
                  placeholder="Feature 1, Feature 2, Feature 3"
                />
              </label>

              <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-bold text-white/70 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-[#06251b] hover:bg-primary-hover active:scale-[0.98] transition-all"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  <span>{editingPlanId ? "Save Changes" : "Create Plan"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
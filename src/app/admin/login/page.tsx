"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, KeyRound, Loader2, Mail } from "lucide-react";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { ensureAccessToken, setAccessToken, setAuthUser } from "@/lib/auth";

export default function AdminLoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"google" | "password">("google");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      const token = await ensureAccessToken();
      if (!token) return;
      try {
        const response = await fetch("/api/admin/overview", {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        if (!active || !response.ok) return;
        const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
        const nextUrl = urlParams?.get("next");
        const target = nextUrl && nextUrl.startsWith("/") && !nextUrl.startsWith("//") ? nextUrl : "/admin";
        router.replace(target);
      } catch {
        // Not authorized, stay on login page
      }
    })();
    return () => {
      active = false;
    };
  }, [router]);

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Invalid administrator credentials.");
      }

      setAccessToken(data.accessToken);
      setAuthUser({
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        role: data.user.role,
        avatarUrl: data.user.avatarUrl || "",
        signedInAt: Date.now(),
      });

      const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      const nextUrl = urlParams?.get("next");
      const target = nextUrl && nextUrl.startsWith("/") && !nextUrl.startsWith("//") ? nextUrl : "/admin";
      router.replace(target);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#06110f] px-4 py-10 text-white">
      <div className="w-full max-w-md rounded-3xl border border-primary/25 bg-[#071b17]/90 p-6 shadow-2xl backdrop-blur-2xl sm:p-8">
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-white/50 hover:text-primary transition">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to MCUSTOCK
        </Link>
        <div className="mt-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
            <Image src="/MCU-LOGO-0.2V-1.png" alt="MCUSTOCK" width={34} height={34} className="h-8 w-8 object-contain" priority />
          </div>
          <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.3em] text-primary">MCUSTOCK</p>
          <h1 className="mt-2 text-2xl font-black">Admin Control Center</h1>
          <p className="mt-2 text-sm text-white/50">Authenticate to access administrative operations.</p>
        </div>

        <div className="mt-6 flex rounded-xl border border-white/10 bg-white/[0.04] p-1">
          <button
            type="button"
            onClick={() => { setTab("google"); setError(""); }}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${tab === "google" ? "bg-primary text-[#06110f] shadow" : "text-white/60 hover:text-white"}`}
          >
            Google Sign-In
          </button>
          <button
            type="button"
            onClick={() => { setTab("password"); setError(""); }}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${tab === "password" ? "bg-primary text-[#06110f] shadow" : "text-white/60 hover:text-white"}`}
          >
            Email & Password
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 font-medium">
            {error}
          </div>
        ) : null}

        <div className="mt-6">
          {tab === "google" ? (
            <GoogleSignInButton mode="admin" />
          ) : (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-1.5">
                  Admin Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 h-4 w-4 text-white/40" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@mcustock.com"
                    className="w-full rounded-xl border border-white/15 bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-white placeholder-white/25 outline-none focus:border-primary transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-3 h-4 w-4 text-white/40" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full rounded-xl border border-white/15 bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-white placeholder-white/25 outline-none focus:border-primary transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-[#06110f] transition hover:bg-primary/90 disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In to Admin Panel"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}


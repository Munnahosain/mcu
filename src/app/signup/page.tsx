"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { setAuthUser, signUpWithSupabase } from "@/lib/auth";
import { getDatabaseProvider, hasSupabaseConfig } from "@/lib/database-config";
import ThemeToggle from "@/components/ThemeToggle";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    setIsLoading(true);

    try {
      let user = null;

      if (getDatabaseProvider() === "supabase" && hasSupabaseConfig()) {
        user = await signUpWithSupabase(name.trim(), email.trim(), password.trim());
      } else {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            password: password.trim()
          }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || "Signup failed");
        }

        user = {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          signedInAt: Date.now(),
        };
      }

      const success = user ? setAuthUser(user) : false;

      if (success) {
        router.push("/dashboard/generator");
        router.refresh();
      } else {
        setError("Failed to create local session.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create account. Please try again.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between p-4 sm:p-6">
      {/* Top navbar */}
      <header className="max-w-7xl w-full mx-auto flex items-center justify-between py-2">
        <Link href="/" className="flex items-center gap-2 text-xs font-bold text-primary border border-primary/20 rounded-xl px-3.5 py-1.5 hover:bg-primary/5 transition-all">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back Home
        </Link>
        <ThemeToggle />
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center py-10">
        <div className="max-w-[420px] w-full border border-primary/20 rounded-3xl p-6 sm:p-8 bg-background shadow-xl flex flex-col gap-6">
          <div className="text-center space-y-1.5">
            <Link href="/" className="liquid-icon-shell inline-flex h-12 w-12 rounded-2xl mb-2">
              <Image src="/MCU-LOGO-0.2V-1.png" alt="MCU Logo" width={34} height={34} className="h-8 w-8 object-contain" />
            </Link>
            <h2 className="text-xl font-bold tracking-tight text-primary">Create Your Account</h2>
            <p className="text-[11px] text-primary/70 font-semibold uppercase tracking-wider">Start automating stock metadata</p>
          </div>

          {error && (
            <div className="text-xs font-bold text-primary border border-dashed border-primary/30 bg-primary/5 rounded-xl p-3 text-center">
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-primary/60 uppercase tracking-widest">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Stock Creator"
                className="w-full text-xs bg-background border border-primary/20 rounded-xl px-3.5 py-2.5 text-primary placeholder-primary/35 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-all"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-primary/60 uppercase tracking-widest">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full text-xs bg-background border border-primary/20 rounded-xl px-3.5 py-2.5 text-primary placeholder-primary/35 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-all"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-primary/60 uppercase tracking-widest">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-xs bg-background border border-primary/20 rounded-xl px-3.5 py-2.5 text-primary placeholder-primary/35 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-primary/40 hover:text-primary transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-primary text-background rounded-xl text-xs font-bold hover:bg-primary-hover disabled:opacity-40 transition-all uppercase tracking-widest flex items-center justify-center gap-1.5"
            >
              {isLoading ? "Creating Account..." : "Create Account"}
            </button>
          </form>

          <p className="text-center text-xs font-bold text-primary/60">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline font-bold">
              Sign in
            </Link>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl w-full mx-auto text-center text-[10px] font-bold tracking-wider text-primary/60 py-2 border-t border-primary/10">
        © MCUSTOCK AI. Safe & Private.
      </footer>
    </div>
  );
}

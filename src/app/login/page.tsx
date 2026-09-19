"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import GoogleSignInButton from "@/components/GoogleSignInButton";

export default function LoginPage() {
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
            <h2 className="text-xl font-bold tracking-tight text-primary">Welcome Back</h2>
            <p className="text-[11px] text-primary/70 font-semibold uppercase tracking-wider">Sign in to MCUSTOCK AI</p>
          </div>

          <GoogleSignInButton />

          <p className="text-center text-xs font-bold text-primary/60">
            Continue securely with your Google account.
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

"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import GoogleSignInButton from "@/components/GoogleSignInButton";

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#06110f] px-4 py-10 text-white">
      <div className="w-full max-w-md rounded-3xl border border-primary/25 bg-white/[0.05] p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-white/50 hover:text-primary">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to MCUSTOCK
        </Link>
        <div className="mt-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
            <Image src="/MCU-LOGO-0.2V-1.png" alt="MCUSTOCK" width={34} height={34} className="h-8 w-8 object-contain" />
          </div>
          <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.3em] text-primary">MCUSTOCK</p>
          <h1 className="mt-2 text-2xl font-black">Admin Control Center</h1>
          <p className="mt-2 text-sm text-white/50">Continue with your authorized Google account.</p>
        </div>
        <div className="mt-7">
          <GoogleSignInButton mode="admin" />
        </div>
      </div>
    </main>
  );
}

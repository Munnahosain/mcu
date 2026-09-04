"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { completeSupabaseAuth } from "@/lib/auth";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const completeLogin = async () => {
      try {
        const user = await completeSupabaseAuth();
        if (!user) throw new Error("Google sign-in could not be completed.");
        router.replace("/dashboard/generator");
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : "Google sign-in failed");
      }
    };

    void completeLogin();
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
      <p className="text-sm font-semibold text-primary">{error || "Completing Google sign-in..."}</p>
    </main>
  );
}